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
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";
import {
  connectTestSocket,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

async function archiveProjectDirect(projectId: string) {
  return prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" },
  });
}

describe("Project restore", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("allows an OWNER to restore an archived project", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", owner.cookie)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ACTIVE");

    const reloaded = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(reloaded.status).toBe("ACTIVE");
  });

  it("allows an ADMIN to restore an archived project", async () => {
    const owner = await signUpTestUser(app);
    const admin = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, admin.userId, "ADMIN");
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", admin.cookie)
      .expect(200);

    expect(response.body.data.status).toBe("ACTIVE");

    const reloaded = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(reloaded.status).toBe("ACTIVE");
  });

  it("rejects a MEMBER attempting to restore a project", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, member.userId, "MEMBER");
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", member.cookie)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.status).toBe("ARCHIVED");
  });

  it("rejects a GUEST attempting to restore a project", async () => {
    const owner = await signUpTestUser(app);
    const guest = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, guest.userId, "GUEST");
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", guest.cookie)
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.status).toBe("ARCHIVED");
  });

  it("rejects a user who is not a member of the project's workspace", async () => {
    const owner = await signUpTestUser(app);
    const outsider = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", outsider.cookie)
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.status).toBe("ARCHIVED");
  });

  it("rejects cross-workspace restore and leaves the project archived", async () => {
    const owner = await signUpTestUser(app);
    const { workspace: workspaceA } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspaceA.id, owner.userId);
    await archiveProjectDirect(project.id);

    // A real member of a *different* workspace - never joins workspaceA.
    const otherOwner = await signUpTestUser(app);
    await createWorkspaceWithMember(otherOwner.userId);

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", otherOwner.cookie)
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.status).toBe("ARCHIVED");
  });

  it("rejects restoring an ACTIVE project", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        ownerId: owner.userId,
        name: "Test Project",
        slug: `test-project-${crypto.randomUUID()}`,
        status: "ACTIVE",
      },
    });

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", owner.cookie)
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.status).toBe("ACTIVE");
  });

  it("rejects restoring a PLANNED project", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        ownerId: owner.userId,
        name: "Test Project",
        slug: `test-project-${crypto.randomUUID()}`,
        status: "PLANNED",
      },
    });

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", owner.cookie)
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.status).toBe("PLANNED");
  });

  it("rejects restoring a COMPLETED project", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        ownerId: owner.userId,
        name: "Test Project",
        slug: `test-project-${crypto.randomUUID()}`,
        status: "COMPLETED",
      },
    });

    const response = await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", owner.cookie)
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    const unchanged = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unchanged.status).toBe("COMPLETED");
  });

  it("creates a PROJECT_RESTORED activity record identifying the project and actor", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const activities = await prisma.activity.findMany({
      where: {
        type: "PROJECT_RESTORED",
        entityId: project.id,
      },
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]?.actorId).toBe(owner.userId);
    expect(activities[0]?.workspaceId).toBe(workspace.id);
    expect(activities[0]?.projectId).toBe(project.id);
    expect(activities[0]?.entityType).toBe("PROJECT");
    expect(activities[0]?.metadata).toMatchObject({
      projectName: project.name,
    });
  });

  it("resolves two concurrent restore requests for the same project to exactly one success", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    // Fired concurrently against the real running app / real Postgres
    // connection pool, mirroring ownership-transfer.test.ts's own
    // concurrent-transfer test - both requests' pre-transaction status reads
    // can genuinely race each other before either transaction's conditional
    // updateMany resolves the outcome. Deliberately not forcing a specific
    // winner (no artificial delay): the compare-and-set guard must produce a
    // consistent, correct outcome regardless of which request's transaction
    // reaches the row first.
    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/v1/projects/${project.id}/restore`)
        .set("Cookie", owner.cookie),
      request(app)
        .post(`/api/v1/projects/${project.id}/restore`)
        .set("Cookie", owner.cookie),
    ]);

    const responses = [first, second];
    const successes = responses.filter((response) => response.status === 200);
    const failures = responses.filter((response) => response.status !== 200);

    expect(successes).toHaveLength(1);
    expect(successes[0]?.body.data.status).toBe("ACTIVE");

    expect(failures).toHaveLength(1);
    expect(failures[0]?.status).toBe(400);
    expect(failures[0]?.body.error.code).toBe("VALIDATION_ERROR");

    const reloaded = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(reloaded.status).toBe("ACTIVE");

    // The loser's transaction rolled back entirely - it must not have
    // created a second PROJECT_RESTORED activity for the same project.
    const activities = await prisma.activity.findMany({
      where: {
        type: "PROJECT_RESTORED",
        entityId: project.id,
      },
    });
    expect(activities).toHaveLength(1);
  });
});

describe("Project restore - realtime", () => {
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

  it("emits PROJECT_RESTORED to the workspace room with the updated project", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const project = await createProjectDirect(workspace.id, owner.userId);
    await archiveProjectDirect(project.id);

    const socket = await connectTestSocket(testServer.baseUrl, owner.cookie);

    // Confirms the socket has actually joined the workspace room before the
    // real assertion below - see waitForEventWithRetries's own comment for
    // why a single wait right after connect can't assume the join landed.
    await waitForEventWithRetries(socket, REALTIME_EVENTS.PROJECT_ARCHIVED, () =>
      emitToWorkspace(workspace.id, REALTIME_EVENTS.PROJECT_ARCHIVED, {
        workspaceId: workspace.id,
      }),
    );

    const eventPromise = waitForEvent<{
      workspaceId: string;
      project: { id: string; status: string };
    }>(socket, REALTIME_EVENTS.PROJECT_RESTORED);

    await request(app)
      .post(`/api/v1/projects/${project.id}/restore`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const payload = await eventPromise;
    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.project.id).toBe(project.id);
    expect(payload.project.status).toBe("ACTIVE");

    socket.disconnect();
  });
});
