import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import { createProjectDirect, createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

async function addTasks(
  workspaceId: string,
  projectId: string,
  createdById: string,
  count: number,
  overrides: { status?: "TODO" | "DONE"; deletedAt?: Date } = {},
) {
  await prisma.task.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      workspaceId,
      projectId,
      createdById,
      title: `Task ${index}`,
      ...overrides,
    })),
  });
}

// Regression (audit F-25): the projects page fetched each project's task list
// (capped at 100) just to count it, so counts were wrong past 100 tasks and
// cost one request per project.
describe("project task counts", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  async function setUp() {
    const user = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(user.userId);
    const big = await createProjectDirect(workspace.id, user.userId);
    const empty = await createProjectDirect(workspace.id, user.userId);

    await addTasks(workspace.id, big.id, user.userId, 120);
    await addTasks(workspace.id, big.id, user.userId, 30, { status: "DONE" });
    // Soft-deleted tasks never count.
    await addTasks(workspace.id, big.id, user.userId, 5, { status: "DONE", deletedAt: new Date() });

    // Another tenant's tasks must not leak into these counts.
    const outsider = await signUpTestUser(app);
    const { workspace: otherWorkspace } = await createWorkspaceWithMember(outsider.userId);
    const otherProject = await createProjectDirect(otherWorkspace.id, outsider.userId);
    await addTasks(otherWorkspace.id, otherProject.id, outsider.userId, 7);

    return { user, workspace, big, empty };
  }

  it("returns exact totals beyond 100 tasks in the project list", async () => {
    const { user, workspace, big, empty } = await setUp();

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/projects`)
      .set("Cookie", user.cookie)
      .expect(200);

    const byId = new Map(
      res.body.data.map((project: { id: string; taskCounts: unknown }) => [project.id, project.taskCounts]),
    );
    expect(byId.get(big.id)).toEqual({ total: 150, completed: 30 });
    expect(byId.get(empty.id)).toEqual({ total: 0, completed: 0 });
  });

  it("returns the same counts on the project detail", async () => {
    const { user, big } = await setUp();

    const res = await request(app)
      .get(`/api/v1/projects/${big.id}`)
      .set("Cookie", user.cookie)
      .expect(200);

    expect(res.body.data.taskCounts).toEqual({ total: 150, completed: 30 });
  });
});
