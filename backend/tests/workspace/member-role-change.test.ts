import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToWorkspace } from "../../src/realtime/realtime.emitter.js";

import { resetDatabase } from "../setup/reset-database.js";
import {
  addWorkspaceMember,
  createWorkspaceWithMember,
  signUpTestUser,
} from "../setup/fixtures.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";
import {
  connectTestSocket,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

describe("Workspace member role change", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("allows an authorized OWNER to change a member's role", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    const response = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .send({ role: "ADMIN" })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe("ADMIN");

    const reloaded = await prisma.workspaceMember.findUniqueOrThrow({
      where: { id: membership.id },
    });
    expect(reloaded.role).toBe("ADMIN");
  });

  it("still enforces existing authorization rules (a MEMBER cannot assign roles)", async () => {
    const owner = await signUpTestUser(app);
    const actingMember = await signUpTestUser(app);
    const target = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, actingMember.userId, "MEMBER");
    const targetMembership = await addWorkspaceMember(workspace.id, target.userId, "MEMBER");

    const response = await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/members/${targetMembership.id}`)
      .set("Cookie", actingMember.cookie)
      .send({ role: "ADMIN" })
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");

    const unchanged = await prisma.workspaceMember.findUniqueOrThrow({
      where: { id: targetMembership.id },
    });
    expect(unchanged.role).toBe("MEMBER");
  });

  it("creates a MEMBER_ROLE_CHANGED activity record with the correct actor, entity, and old/new role metadata", async () => {
    const owner = await signUpTestUser(app);
    const member = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, member.userId, "MEMBER");

    await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .send({ role: "ADMIN" })
      .expect(200);

    const activities = await prisma.activity.findMany({
      where: {
        type: "MEMBER_ROLE_CHANGED",
        entityId: membership.id,
      },
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]?.actorId).toBe(owner.userId);
    expect(activities[0]?.workspaceId).toBe(workspace.id);
    expect(activities[0]?.entityType).toBe("MEMBER");
    expect(activities[0]?.metadata).toMatchObject({
      oldRole: "MEMBER",
      newRole: "ADMIN",
    });
  });

  it("does not create an activity record or change the role when the update is rejected", async () => {
    const owner = await signUpTestUser(app);
    const actingMember = await signUpTestUser(app);
    const target = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    await addWorkspaceMember(workspace.id, actingMember.userId, "MEMBER");
    const targetMembership = await addWorkspaceMember(workspace.id, target.userId, "MEMBER");

    await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/members/${targetMembership.id}`)
      .set("Cookie", actingMember.cookie)
      .send({ role: "ADMIN" })
      .expect(403);

    const activities = await prisma.activity.findMany({
      where: {
        type: "MEMBER_ROLE_CHANGED",
        entityId: targetMembership.id,
      },
    });
    expect(activities).toHaveLength(0);
  });

  it("resolves a concurrent role change and member removal for the same target to a typed outcome, never a raw 500", async () => {
    const owner = await signUpTestUser(app);
    const target = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const membership = await addWorkspaceMember(workspace.id, target.userId, "MEMBER");

    // Fired concurrently against the real running app / real Postgres
    // connection pool, mirroring member-removal.test.ts's own
    // concurrent-removal test. An OWNER can manage both MEMBER and ADMIN
    // targets, so removal succeeds regardless of which request's
    // transaction reaches the shared WorkspaceMember-row lock first - only
    // the role-change side's outcome depends on who wins.
    const [roleChange, removal] = await Promise.all([
      request(app)
        .patch(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie)
        .send({ role: "ADMIN" }),
      request(app)
        .delete(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
        .set("Cookie", owner.cookie),
    ]);

    expect(removal.status).toBe(200);

    const reloadedMembership = await prisma.workspaceMember.findUnique({
      where: { id: membership.id },
    });
    expect(reloadedMembership).toBeNull();

    if (roleChange.status !== 200) {
      // Removal won: the role update must fail with the typed
      // NotFoundError translated from Prisma's P2025, never an unhandled
      // 500.
      expect(roleChange.status).toBe(404);
      expect(roleChange.body.error.code).toBe("NOT_FOUND");
    }

    // No MEMBER_ROLE_CHANGED activity from a failed role update.
    const roleActivities = await prisma.activity.findMany({
      where: { type: "MEMBER_ROLE_CHANGED", entityId: membership.id },
    });
    expect(roleActivities).toHaveLength(roleChange.status === 200 ? 1 : 0);
  });
});

describe("Workspace member role change - realtime", () => {
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

  it("emits MEMBER_ROLE_CHANGED to the workspace room with the old and new role", async () => {
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
      oldRole: string;
      newRole: string;
    }>(socket, REALTIME_EVENTS.MEMBER_ROLE_CHANGED);

    await request(app)
      .patch(`/api/v1/workspaces/${workspace.id}/members/${membership.id}`)
      .set("Cookie", owner.cookie)
      .send({ role: "ADMIN" })
      .expect(200);

    const payload = await eventPromise;
    expect(payload.workspaceId).toBe(workspace.id);
    expect(payload.memberId).toBe(membership.id);
    expect(payload.userId).toBe(member.userId);
    expect(payload.oldRole).toBe("MEMBER");
    expect(payload.newRole).toBe("ADMIN");

    socket.disconnect();
  });
});
