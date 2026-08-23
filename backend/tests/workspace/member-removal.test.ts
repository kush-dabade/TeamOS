import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToWorkspace } from "../../src/realtime/realtime.emitter.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createProjectDirect,
  createTaskDirect,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";
import {
  connectTestSocket,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

describe("Workspace member removal", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("removes an eligible member", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    const response = await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(response.body.success).toBe(true);

    const reloaded = await prisma.workspaceMember.findUnique({
      where: { id: membership.id },
    });
    expect(reloaded).toBeNull();
  });

  it("still enforces existing authorization rules (a MEMBER cannot remove another member)", async () => {
    const owner = await signUpTestUser(app);
    const actingMember = await signUpTestUser(app);
    const target = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, actingMember.userId, "MEMBER");
    const targetMembership = await addWorkspaceMember(workspace.id, target.userId, "MEMBER");

    const response = await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/members/${targetMembership.id}`)
      .set("Cookie", actingMember.cookie)
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");

    const stillThere = await prisma.workspaceMember.findUnique({
      where: { id: targetMembership.id },
    });
    expect(stillThere).not.toBeNull();
  });

  describe("ownership precondition", () => {
    it("rejects removal of a member who owns one project", async () => {
      const owner = await signUpTestUser(app);
      const member = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
      const project = await createProjectDirect(workspace.id, member.userId);

      const response = await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.message).toContain("1 project");

      const stillThere = await prisma.workspaceMember.findUnique({
        where: { id: membership.id },
      });
      expect(stillThere).not.toBeNull();

      const unchangedProject = await prisma.project.findUniqueOrThrow({
        where: { id: project.id },
      });
      expect(unchangedProject.ownerId).toBe(member.userId);
    });

    it("rejects removal of a member who owns multiple projects, reporting the count", async () => {
      const owner = await signUpTestUser(app);
      const member = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
      await createProjectDirect(workspace.id, member.userId, "Project A");
      await createProjectDirect(workspace.id, member.userId, "Project B");

      const response = await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.message).toContain("2 project");
    });

    it("allows removal once ownership has been transferred away from the member", async () => {
      const owner = await signUpTestUser(app);
      const member = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
      const project = await createProjectDirect(workspace.id, member.userId);

      await request(app)
        .post(`/api/v1/projects/${project.id}/transfer-ownership`)
        .set("Cookie", owner.cookie)
        .send({ newOwnerId: owner.userId })
        .expect(200);

      const response = await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      expect(response.body.success).toBe(true);

      const reloaded = await prisma.workspaceMember.findUnique({
        where: { id: membership.id },
      });
      expect(reloaded).toBeNull();
    });
  });

  describe("task assignee cleanup", () => {
    it("nulls the removed member's task assignments across multiple projects, preserving the tasks", async () => {
      const owner = await signUpTestUser(app);
      const member = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
      const projectA = await createProjectDirect(workspace.id, owner.userId, "Project A");
      const projectB = await createProjectDirect(workspace.id, owner.userId, "Project B");
      const taskA = await createTaskDirect(
        workspace.id,
        projectA.id,
        owner.userId,
        "Task A",
        member.userId,
      );
      const taskB = await createTaskDirect(
        workspace.id,
        projectB.id,
        owner.userId,
        "Task B",
        member.userId,
      );

      await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      const [reloadedA, reloadedB] = await Promise.all([
        prisma.task.findUniqueOrThrow({ where: { id: taskA.id } }),
        prisma.task.findUniqueOrThrow({ where: { id: taskB.id } }),
      ]);

      expect(reloadedA.assigneeId).toBeNull();
      expect(reloadedB.assigneeId).toBeNull();
    });

    it("does not touch another member's assignments", async () => {
      const owner = await signUpTestUser(app);
      const member = await signUpTestUser(app);
      const otherMember = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
      await addWorkspaceMember(workspace.id, otherMember.userId, "MEMBER");
      const project = await createProjectDirect(workspace.id, owner.userId);
      const otherTask = await createTaskDirect(
        workspace.id,
        project.id,
        owner.userId,
        "Other member's task",
        otherMember.userId,
      );

      await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      const reloaded = await prisma.task.findUniqueOrThrow({
        where: { id: otherTask.id },
      });
      expect(reloaded.assigneeId).toBe(otherMember.userId);
    });

    it("does not touch a soft-deleted task's assignment", async () => {
      const owner = await signUpTestUser(app);
      const member = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(owner.userId);
      const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
      const project = await createProjectDirect(workspace.id, owner.userId);
      const deletedTask = await createTaskDirect(
        workspace.id,
        project.id,
        owner.userId,
        "Deleted task",
        member.userId,
      );
      await prisma.task.update({
        where: { id: deletedTask.id },
        data: { deletedAt: new Date() },
      });

      await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      const reloaded = await prisma.task.findUniqueOrThrow({
        where: { id: deletedTask.id },
      });
      expect(reloaded.assigneeId).toBe(member.userId);
    });

    it("does not touch a task with the same assignee in a different workspace", async () => {
      const owner = await signUpTestUser(app);
      const member = await signUpTestUser(app);
      const { workspace: workspaceA } = await createWorkspaceWithMember(owner.userId);
      const membershipA = await addWorkspaceMember(workspaceA.id, member.userId, "MEMBER");

      const otherOwner = await signUpTestUser(app);
      const { workspace: workspaceB } = await createWorkspaceWithMember(otherOwner.userId);
      await addWorkspaceMember(workspaceB.id, member.userId, "MEMBER");
      const projectB = await createProjectDirect(workspaceB.id, otherOwner.userId);
      const taskB = await createTaskDirect(
        workspaceB.id,
        projectB.id,
        otherOwner.userId,
        "Task in workspace B",
        member.userId,
      );

      await request(app)
        .delete(`/api/v1/workspaces/${workspaceA.id}/members/${membershipA.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);

      const reloaded = await prisma.task.findUniqueOrThrow({
        where: { id: taskB.id },
      });
      expect(reloaded.assigneeId).toBe(member.userId);
    });
  });

  it("preserves historical activity where the removed user is the actor", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId, "Project");

    await request(app)
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set("Cookie", member.cookie)
      .send({ title: "Task created by member" })
      .expect(201);

    const priorActivity = await prisma.activity.findFirstOrThrow({
      where: { actorId: member.userId, type: "TASK_CREATED" },
    });

    await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const reloadedActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: priorActivity.id },
    });
    expect(reloadedActivity.actorId).toBe(member.userId);
  });

  it("creates a MEMBER_REMOVED activity record with the removed user's identity in metadata", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const activities = await prisma.activity.findMany({
      where: {
        type: "MEMBER_REMOVED",
        entityId: membership.id,
      },
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]?.actorId).toBe(owner.userId);
    expect(activities[0]?.workspaceId).toBe(workspace.id);
    expect(activities[0]?.entityType).toBe("MEMBER");
    expect(activities[0]?.metadata).toMatchObject({
      removedUserEmail: member.email,
    });
  });

  it("does not create an activity record or remove the member when rejected by the ownership precondition", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
    await createProjectDirect(workspace.id, member.userId);

    await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .expect(400);

    const activities = await prisma.activity.findMany({
      where: {
        type: "MEMBER_REMOVED",
        entityId: membership.id,
      },
    });
    expect(activities).toHaveLength(0);
  });

  it("resolves two concurrent removal requests for the same member to exactly one success and one not-found", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    // Fired concurrently against the real running app / real Postgres
    // connection pool, mirroring sprint-active-invariant.test.ts's own
    // concurrent-request pattern - both requests' reads can genuinely race
    // each other before either transaction commits.
    const [responseA, responseB] = await Promise.all([
      request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie),
      request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie),
    ]);

    const results = [responseA, responseB];
    const successes = results.filter((r) => r.status === 200);
    const notFound = results.filter((r) => r.status === 404);

    expect(successes).toHaveLength(1);
    expect(notFound).toHaveLength(1);
    expect(notFound[0]?.body.error.code).toBe("NOT_FOUND");

    const reloaded = await prisma.workspaceMember.findUnique({
      where: { id: membership.id },
    });
    expect(reloaded).toBeNull();

    // Exactly one MEMBER_REMOVED activity was recorded, not two - the
    // loser's transaction rolled back entirely (same style of assertion as
    // sprint-active-invariant.test.ts's concurrent-activation test).
    const activities = await prisma.activity.findMany({
      where: { type: "MEMBER_REMOVED", entityId: membership.id },
    });
    expect(activities).toHaveLength(1);
  });
});

describe("Workspace member removal - realtime", () => {
  let testServer: TestServer;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await testServer.close();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("emits MEMBER_REMOVED to the workspace room", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    const socket = await connectTestSocket(testServer.baseUrl, owner.cookie);

    // Confirms the socket has actually joined the workspace room before the
    // real assertion below - see waitForEventWithRetries's own comment for
    // why a single wait right after connect can't assume the join landed.
    await waitForEventWithRetries(socket, REALTIME_EVENTS.PROJECT_CREATED, () =>
      emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_CREATED, {
        workspaceId: workspace.id,
      }),
    );

    const eventPromise = waitForEvent<{
      workspaceId: string;
      memberId: string;
      userId: string;
    }>(socket, REALTIME_EVENTS.MEMBER_REMOVED);

    await request(app)
      .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const payload = await eventPromise;
    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.memberId).toBe(membership.id);
    expect(payload.userId).toBe(member.userId);

    socket.disconnect();
  });
});
