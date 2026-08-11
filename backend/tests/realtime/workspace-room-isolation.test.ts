import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";

import app from "../../src/app.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToUser, emitToWorkspace } from "../../src/realtime/realtime.emitter.js";
import {
  leaveWorkspace,
  removeWorkspaceMember,
} from "../../src/modules/workspace/workspace.service.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { addWorkspaceMember, createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";
import { connectTestSocket, trackEvent, waitForEvent, waitForEventWithRetries } from "../setup/socket-client.js";

// Distinct event names for "the workspace event under test" vs "a
// sentinel used only to prove a connection is alive/joined" - this way a
// waitForEvent for one can never accidentally resolve from the other, no
// payload-matching logic needed to tell them apart.
const WORKSPACE_EVENT = REALTIME_EVENTS.TASK_CREATED;
const CROSS_WORKSPACE_SENTINEL = REALTIME_EVENTS.PROJECT_CREATED;
const USER_ROOM_SENTINEL = REALTIME_EVENTS.NOTIFICATION_CREATED;

describe("realtime workspace room isolation", () => {
  let server: TestServer;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    openSockets.forEach((socket) => socket.disconnect());
    openSockets.length = 0;

    await resetDatabase();
  });

  async function connect(cookie: string): Promise<Socket> {
    const socket = await connectTestSocket(server.baseUrl, cookie);
    openSockets.push(socket);
    return socket;
  }

  /** Confirms `socket` actually joined workspaceId's room - see waitForEventWithRetries. */
  function confirmJoined(socket: Socket, workspaceId: string) {
    return waitForEventWithRetries(socket, WORKSPACE_EVENT, () =>
      emitToWorkspace(workspaceId, WORKSPACE_EVENT, { marker: "confirm-joined" }),
    );
  }

  it("delivers a workspace event to a member's connected socket", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const socket = await connect(owner.cookie);

    await confirmJoined(socket, workspace.id);
  });

  it("does not deliver another workspace's events to a non-member", async () => {
    const owner = await signUpTestUser(app);
    const { workspace: workspaceA } = await createWorkspaceWithMember(owner.userId);

    const otherOwner = await signUpTestUser(app);
    const { workspace: workspaceB } = await createWorkspaceWithMember(otherOwner.userId);

    const socket = await connect(owner.cookie);

    // Confirms the socket is live and joined to A before testing isolation.
    await confirmJoined(socket, workspaceA.id);

    const forbidden = trackEvent(socket, WORKSPACE_EVENT);

    emitToWorkspace(workspaceB.id, WORKSPACE_EVENT, { marker: "forbidden" });
    emitToWorkspace(workspaceA.id, CROSS_WORKSPACE_SENTINEL, { marker: "sentinel" });

    await waitForEvent(socket, CROSS_WORKSPACE_SENTINEL);

    expect(forbidden.wasReceived()).toBe(false);
    forbidden.stop();
  });

  it("evicts the socket and stops delivery after removeWorkspaceMember", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const target = await signUpTestUser(app);
    const membership = await addWorkspaceMember(workspace.id, target.userId, WorkspaceRole.MEMBER);

    const socket = await connect(target.cookie);

    await confirmJoined(socket, workspace.id);

    // Registered before the triggering call, not after - removeWorkspaceMember
    // can emit WORKSPACE_ACCESS_REVOKED before its own promise resolves, so
    // awaiting a listener registered afterward would only pass because of
    // favorable event-loop scheduling, not a guaranteed ordering.
    const revocationEvent = waitForEvent<{ workspaceId: string }>(
      socket,
      REALTIME_EVENTS.WORKSPACE_ACCESS_REVOKED,
    );

    await removeWorkspaceMember(owner.userId, workspace.id, membership.id);

    const revoked = await revocationEvent;
    expect(revoked.workspaceId).toBe(workspace.id);

    const forbidden = trackEvent(socket, WORKSPACE_EVENT);

    emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "forbidden" });
    emitToUser(target.userId, USER_ROOM_SENTINEL, { marker: "sentinel" });

    await waitForEvent(socket, USER_ROOM_SENTINEL);

    expect(forbidden.wasReceived()).toBe(false);
    forbidden.stop();
  });

  it("evicts and notifies all of a user's connected sockets", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const target = await signUpTestUser(app);
    const membership = await addWorkspaceMember(workspace.id, target.userId, WorkspaceRole.MEMBER);

    const socketA = await connect(target.cookie);
    const socketB = await connect(target.cookie);

    await Promise.all([confirmJoined(socketA, workspace.id), confirmJoined(socketB, workspace.id)]);

    // Registered before the triggering call, not after - see the
    // equivalent comment in the single-socket removeWorkspaceMember test
    // above for why.
    const revocationEventA = waitForEvent<{ workspaceId: string }>(
      socketA,
      REALTIME_EVENTS.WORKSPACE_ACCESS_REVOKED,
    );
    const revocationEventB = waitForEvent<{ workspaceId: string }>(
      socketB,
      REALTIME_EVENTS.WORKSPACE_ACCESS_REVOKED,
    );

    await removeWorkspaceMember(owner.userId, workspace.id, membership.id);

    const [revokedA, revokedB] = await Promise.all([revocationEventA, revocationEventB]);
    expect(revokedA.workspaceId).toBe(workspace.id);
    expect(revokedB.workspaceId).toBe(workspace.id);

    const forbiddenA = trackEvent(socketA, WORKSPACE_EVENT);
    const forbiddenB = trackEvent(socketB, WORKSPACE_EVENT);

    emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "forbidden" });
    emitToUser(target.userId, USER_ROOM_SENTINEL, { marker: "sentinel" });

    await Promise.all([
      waitForEvent(socketA, USER_ROOM_SENTINEL),
      waitForEvent(socketB, USER_ROOM_SENTINEL),
    ]);

    expect(forbiddenA.wasReceived()).toBe(false);
    expect(forbiddenB.wasReceived()).toBe(false);
    forbiddenA.stop();
    forbiddenB.stop();
  });

  it("does not rejoin the revoked workspace room on reconnect", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const target = await signUpTestUser(app);
    const membership = await addWorkspaceMember(workspace.id, target.userId, WorkspaceRole.MEMBER);

    const firstSocket = await connect(target.cookie);
    await confirmJoined(firstSocket, workspace.id);

    // Registered before the triggering call, not after - see the
    // equivalent comment in the single-socket removeWorkspaceMember test
    // above for why.
    const revocationEvent = waitForEvent(firstSocket, REALTIME_EVENTS.WORKSPACE_ACCESS_REVOKED);

    await removeWorkspaceMember(owner.userId, workspace.id, membership.id);
    await revocationEvent;

    firstSocket.disconnect();

    const reconnected = await connect(target.cookie);

    // Registered before anything else on this new connection - a forbidden
    // delivery at any point from here on (including during the retried
    // liveness check below) will still be observed.
    const forbidden = trackEvent(reconnected, WORKSPACE_EVENT);

    // Confirms the reconnected socket is live and its user room joined,
    // using the same retry treatment as any fresh-connect delivery check -
    // its own joinUserRoom() call has the identical connect-vs-join race.
    // This is not itself the non-delivery proof - it only establishes the
    // connection is ready before running the prescribed forbidden -> sentinel
    // -> wait -> assert sequence below.
    await waitForEventWithRetries(reconnected, USER_ROOM_SENTINEL, () =>
      emitToUser(target.userId, USER_ROOM_SENTINEL, { marker: "liveness-check" }),
    );

    emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "forbidden" });
    emitToUser(target.userId, USER_ROOM_SENTINEL, { marker: "sentinel" });

    await waitForEvent(reconnected, USER_ROOM_SENTINEL);

    expect(forbidden.wasReceived()).toBe(false);
    forbidden.stop();
  });

  it("leaveWorkspace evicts the leaving member's other connected sockets", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const target = await signUpTestUser(app);
    await addWorkspaceMember(workspace.id, target.userId, WorkspaceRole.MEMBER);

    const socketA = await connect(target.cookie);
    const socketB = await connect(target.cookie);

    await Promise.all([confirmJoined(socketA, workspace.id), confirmJoined(socketB, workspace.id)]);

    // Registered before the triggering call, not after - see the
    // equivalent comment in the single-socket removeWorkspaceMember test
    // above for why.
    const revocationEventA = waitForEvent<{ workspaceId: string }>(
      socketA,
      REALTIME_EVENTS.WORKSPACE_ACCESS_REVOKED,
    );
    const revocationEventB = waitForEvent<{ workspaceId: string }>(
      socketB,
      REALTIME_EVENTS.WORKSPACE_ACCESS_REVOKED,
    );

    await leaveWorkspace(target.userId, workspace.id);

    const [revokedA, revokedB] = await Promise.all([revocationEventA, revocationEventB]);
    expect(revokedA.workspaceId).toBe(workspace.id);
    expect(revokedB.workspaceId).toBe(workspace.id);

    const forbiddenA = trackEvent(socketA, WORKSPACE_EVENT);
    const forbiddenB = trackEvent(socketB, WORKSPACE_EVENT);

    emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "forbidden" });
    emitToUser(target.userId, USER_ROOM_SENTINEL, { marker: "sentinel" });

    await Promise.all([
      waitForEvent(socketA, USER_ROOM_SENTINEL),
      waitForEvent(socketB, USER_ROOM_SENTINEL),
    ]);

    expect(forbiddenA.wasReceived()).toBe(false);
    expect(forbiddenB.wasReceived()).toBe(false);
    forbiddenA.stop();
    forbiddenB.stop();
  });
});
