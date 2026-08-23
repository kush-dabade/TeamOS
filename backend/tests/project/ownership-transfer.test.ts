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

describe("Project ownership transfer", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("allows an OWNER to transfer ownership to another eligible member", async () => {
    const owner = await signUpTestUser(app);
    const newOwner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, newOwner.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: newOwner.userId })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.ownerId).toBe(newOwner.userId);

    const reloaded = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(reloaded.ownerId).toBe(newOwner.userId);
  });

  it("allows an ADMIN to transfer ownership", async () => {
    const owner = await signUpTestUser(app);
    const admin = await signUpTestUser(app);
    const newOwner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, admin.userId, "ADMIN");
    await addWorkspaceMember(workspace.id, newOwner.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", admin.cookie)
      .send({ newOwnerId: newOwner.userId })
      .expect(200);

    expect(response.body.data.ownerId).toBe(newOwner.userId);
  });

  it("rejects a MEMBER attempting to transfer ownership", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const newOwner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
    await addWorkspaceMember(workspace.id, newOwner.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", member.cookie)
      .send({ newOwnerId: newOwner.userId })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.ownerId).toBe(owner.userId);
  });

  it("rejects a GUEST attempting to transfer ownership", async () => {
    const owner = await signUpTestUser(app);
    const guest = await signUpTestUser(app);
    const newOwner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, guest.userId, "GUEST");
    await addWorkspaceMember(workspace.id, newOwner.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", guest.cookie)
      .send({ newOwnerId: newOwner.userId })
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects transferring ownership to a GUEST", async () => {
    const owner = await signUpTestUser(app);
    const guest = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, guest.userId, "GUEST");
    const project = await createProjectDirect(workspace.id, owner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: guest.userId })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.ownerId).toBe(owner.userId);
  });

  it("rejects transferring ownership to a user who is not a member of this workspace", async () => {
    const owner = await signUpTestUser(app);
    const outsider = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: outsider.userId })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects cross-workspace ownership transfer and leaves both workspaces' data untouched", async () => {
    const owner = await signUpTestUser(app);
    const { workspace: workspaceA } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspaceA.id, owner.userId);

    // A real member of a *different* workspace - never joins workspaceA.
    const otherOwner = await signUpTestUser(app);
    const { workspace: workspaceB } = await createWorkspaceWithMember(otherOwner.userId);
    const projectB = await createProjectDirect(workspaceB.id, otherOwner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: otherOwner.userId })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    const unchangedA = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchangedA.ownerId).toBe(owner.userId);

    // Tenant isolation: workspace B's own project is completely untouched
    // by a rejected cross-workspace attempt against workspace A.
    const unchangedB = await prisma.project.findUniqueOrThrow({
      where: { id: projectB.id },
    });
    expect(unchangedB.ownerId).toBe(otherOwner.userId);
  });

  it("rejects transferring ownership to the current owner", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: owner.userId })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows ownership transfer of an ARCHIVED project, and the project remains ARCHIVED afterward", async () => {
    const owner = await signUpTestUser(app);
    const newOwner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, newOwner.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);

    await request(app)
      .post(`/api/v1/projects/${project.id}/archive`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: newOwner.userId })
      .expect(200);

    expect(response.body.data.ownerId).toBe(newOwner.userId);
    expect(response.body.data.status).toBe("ARCHIVED");

    const reloaded = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(reloaded.ownerId).toBe(newOwner.userId);
    expect(reloaded.status).toBe("ARCHIVED");
  });

  it("creates a PROJECT_OWNERSHIP_TRANSFERRED activity record identifying the project and both owners", async () => {
    const owner = await signUpTestUser(app);
    const newOwner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, newOwner.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);

    await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: newOwner.userId })
      .expect(200);

    const activities = await prisma.activity.findMany({
      where: {
        type: "PROJECT_OWNERSHIP_TRANSFERRED",
        entityId: project.id,
      },
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]?.actorId).toBe(owner.userId);
    expect(activities[0]?.workspaceId).toBe(workspace.id);
    expect(activities[0]?.projectId).toBe(project.id);
    expect(activities[0]?.metadata).toMatchObject({
      previousOwnerId: owner.userId,
      newOwnerId: newOwner.userId,
    });
  });

  it("resolves a concurrent ownership transfer and member removal for the same target to a consistent final state", async () => {
    const owner = await signUpTestUser(app);
    const target = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const targetMembership = await addWorkspaceMember(workspace.id, target.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);
    const otherProject = await createProjectDirect(workspace.id, owner.userId, "Other Project");
    const task = await createTaskDirect(
      workspace.id,
      otherProject.id,
      owner.userId,
      "Target's task",
      target.userId,
    );

    // Fired concurrently against the real running app / real Postgres
    // connection pool, mirroring member-removal.test.ts's own
    // concurrent-removal test - both requests' pre-transaction reads can
    // genuinely race each other before either transaction's row lock
    // resolves the outcome. Deliberately not forcing a specific winner (no
    // artificial delay): the shared lock on target's WorkspaceMember row
    // must produce a consistent, correct outcome regardless of which
    // request's transaction reaches it first, so the assertions below cover
    // both possible outcomes rather than asserting one is "the" outcome.
    const [transfer, removal] = await Promise.all([
      request(app)
        .post(`/api/v1/projects/${project.id}/transfer-ownership`)
        .set("Cookie", owner.cookie)
        .send({ newOwnerId: target.userId }),
      request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${targetMembership.id}`)
        .set("Cookie", owner.cookie),
    ]);

    const [reloadedProject, reloadedMembership, reloadedTask] = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: project.id } }),
      prisma.workspaceMember.findUnique({ where: { id: targetMembership.id } }),
      prisma.task.findUniqueOrThrow({ where: { id: task.id } }),
    ]);

    if (transfer.status === 200) {
      // Transfer won the race: removal must have observed the freshly
      // committed ownership (via the shared lock on target's membership
      // row) and been rejected as a typed business error, never a raw 500.
      expect(removal.status).toBe(400);
      expect(removal.body.error.code).toBe("VALIDATION_ERROR");
      expect(reloadedProject.ownerId).toBe(target.userId);
      expect(reloadedMembership).not.toBeNull();
      // Removal's transaction rolled back in full, including its
      // task-assignee cleanup - target's unrelated task is untouched, not
      // partially nulled.
      expect(reloadedTask.assigneeId).toBe(target.userId);
    } else {
      // Removal won the race: transfer must have observed (via the same
      // shared lock) that the target's membership was gone, and been
      // rejected as a typed business error - Project.ownerId is never left
      // pointing at a user who is not a workspace member.
      expect(transfer.status).toBe(400);
      expect(transfer.body.error.code).toBe("VALIDATION_ERROR");
      expect(removal.status).toBe(200);
      expect(reloadedProject.ownerId).toBe(owner.userId);
      expect(reloadedMembership).toBeNull();
      expect(reloadedTask.assigneeId).toBeNull();
    }

    // The actual invariant under test, asserted directly regardless of
    // which operation won: the project's current owner is never a departed
    // member.
    if (reloadedProject.ownerId === target.userId) {
      expect(reloadedMembership).not.toBeNull();
    }

    // Exactly one winner recorded exactly one activity - the loser's
    // transaction rolled back entirely, same style of assertion as
    // member-removal.test.ts's concurrent-removal test.
    const [transferActivities, removalActivities] = await Promise.all([
      prisma.activity.findMany({
        where: { type: "PROJECT_OWNERSHIP_TRANSFERRED", entityId: project.id },
      }),
      prisma.activity.findMany({
        where: { type: "MEMBER_REMOVED", entityId: targetMembership.id },
      }),
    ]);
    expect(transferActivities.length + removalActivities.length).toBe(1);
  });
});

describe("Project ownership transfer - realtime", () => {
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

  it("emits PROJECT_OWNERSHIP_TRANSFERRED to the workspace room with the updated project", async () => {
    const owner = await signUpTestUser(app);
    const newOwner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, newOwner.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);

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
      project: { id: string; ownerId: string };
    }>(socket, REALTIME_EVENTS.PROJECT_OWNERSHIP_TRANSFERRED);

    await request(app)
      .post(`/api/v1/projects/${project.id}/transfer-ownership`)
      .set("Cookie", owner.cookie)
      .send({ newOwnerId: newOwner.userId })
      .expect(200);

    const payload = await eventPromise;
    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.project.id).toBe(project.id);
    expect(payload.project.ownerId).toBe(newOwner.userId);

    socket.disconnect();
  });
});
