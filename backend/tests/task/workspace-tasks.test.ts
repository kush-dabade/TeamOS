import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";

describe("GET /api/v1/workspaces/:workspaceId/tasks", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("returns tasks across every project in the workspace, in the standard pagination envelope", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const projectA = await createProjectDirect(workspace.id, owner.userId, "Project A");
    const projectB = await createProjectDirect(workspace.id, owner.userId, "Project B");

    const taskA = await createTaskDirect(workspace.id, projectA.id, owner.userId, "Task A");
    const taskB = await createTaskDirect(workspace.id, projectB.id, owner.userId, "Task B");

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/tasks`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 2, pages: 1 });

    const returnedIds = res.body.data.tasks.map((task: { id: string }) => task.id);
    expect(returnedIds.sort()).toEqual([taskA.id, taskB.id].sort());
  });

  it("pages through more tasks than the old single-request 100-per-project cap without losing or duplicating any", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const TASK_COUNT = 130;
    const PAGE_LIMIT = 50;

    // Bulk direct insert - the fixtures' one-at-a-time createTaskDirect
    // would work but is unnecessarily slow for 130 rows; this is the same
    // Prisma model, just createMany instead.
    await prisma.task.createMany({
      data: Array.from({ length: TASK_COUNT }, (_, index) => ({
        workspaceId: workspace.id,
        projectId: project.id,
        title: `Task ${index}`,
        createdById: owner.userId,
      })),
    });

    const seenIds = new Set<string>();
    let page = 1;
    let totalPages: number;

    do {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspace.id}/tasks`)
        .query({ page, limit: PAGE_LIMIT })
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(res.body.pagination.total).toBe(TASK_COUNT);
      totalPages = res.body.pagination.pages;

      const pageIds: string[] = res.body.data.tasks.map((task: { id: string }) => task.id);

      // No duplicates within or across pages - every id is new to the set.
      for (const id of pageIds) {
        expect(seenIds.has(id)).toBe(false);
        seenIds.add(id);
      }

      page++;
    } while (page <= totalPages);

    expect(totalPages).toBe(Math.ceil(TASK_COUNT / PAGE_LIMIT));
    expect(seenIds.size).toBe(TASK_COUNT);
  });

  it("only returns the requesting member's own workspace's tasks, and rejects a non-member outright", async () => {
    const ownerA = await signUpTestUser(app);
    const { workspace: workspaceA } = await createWorkspaceWithMember(ownerA.userId);
    const projectA = await createProjectDirect(workspaceA.id, ownerA.userId);
    const taskA = await createTaskDirect(workspaceA.id, projectA.id, ownerA.userId, "Workspace A task");

    const ownerB = await signUpTestUser(app);
    const { workspace: workspaceB } = await createWorkspaceWithMember(ownerB.userId);
    const projectB = await createProjectDirect(workspaceB.id, ownerB.userId);
    await createTaskDirect(workspaceB.id, projectB.id, ownerB.userId, "Workspace B task");

    // A is genuinely not a member of B at all - not merely a lower role -
    // so a passing 403 here proves the membership check itself, matching
    // tenant-isolation.test.ts's cross-workspace scenario shape.
    const forbidden = await request(app)
      .get(`/api/v1/workspaces/${workspaceB.id}/tasks`)
      .set("Cookie", ownerA.cookie)
      .expect(403);

    expect(forbidden.body.success).toBe(false);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    const ownWorkspace = await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}/tasks`)
      .set("Cookie", ownerA.cookie)
      .expect(200);

    const returnedIds = ownWorkspace.body.data.tasks.map((task: { id: string }) => task.id);
    expect(returnedIds).toEqual([taskA.id]);
  });

  it("excludes soft-deleted tasks, matching the per-project endpoint's contract", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const liveTask = await createTaskDirect(workspace.id, project.id, owner.userId, "Live task");
    const deletedTask = await createTaskDirect(workspace.id, project.id, owner.userId, "Deleted task");

    await prisma.task.update({
      where: { id: deletedTask.id },
      data: { deletedAt: new Date() },
    });

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/tasks`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const returnedIds = res.body.data.tasks.map((task: { id: string }) => task.id);
    expect(returnedIds).toEqual([liveTask.id]);
  });

  it("rejects an unauthenticated request", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/tasks`)
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });
});
