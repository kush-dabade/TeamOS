import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
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

  it("does not let a socket retain a workspace room joined from a stale membership snapshot when it connects concurrently with its own removal", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const target = await signUpTestUser(app);
    const membership = await addWorkspaceMember(workspace.id, target.userId, WorkspaceRole.MEMBER);

    // Fires the connection and the removal concurrently, without waiting
    // for the socket to finish joining its rooms first - connect()
    // resolves on the client's "connect" event, which (per
    // waitForEventWithRetries's own comment) fires before the server's
    // async joinWorkspaceRooms necessarily completes. Racing
    // removeWorkspaceMember against that in-flight join is what actually
    // exercises the race described in the review: a socket that read a
    // pre-removal membership snapshot but joins the workspace room *after*
    // evictFromWorkspace's own fetchSockets() snapshot already ran. This
    // is a real, non-contrived interleaving against a real Postgres
    // instance, not two operations forced into one specific order.
    const [socket] = await Promise.all([
      connect(target.cookie),
      removeWorkspaceMember(owner.userId, workspace.id, membership.id),
    ]);

    // A single immediate check would be meaningless here: the socket's own
    // connection setup (self-correction, or an in-flight eviction) is still
    // an open async chain at this point, so checking too early would pass
    // regardless of whether the underlying race is actually closed - not
    // because delivery was proven absent, but because it hadn't had time to
    // happen yet either way. waitForEventWithRetries's own retry budget (10
    // attempts, real emits, 200ms each) gives that chain real wall-clock
    // time to settle before concluding anything; rejecting after exhausting
    // every attempt is the actual proof of non-delivery, not a single
    // early snapshot.
    await expect(
      waitForEventWithRetries(socket, WORKSPACE_EVENT, () =>
        emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "forbidden" }),
      ),
    ).rejects.toThrow();
  });

  it("does not join the workspace room when the connecting socket's membership read resolves after the removal already committed (deterministic race)", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);

    const target = await signUpTestUser(app);
    const membership = await addWorkspaceMember(workspace.id, target.userId, WorkspaceRole.MEMBER);

    // The Promise.all test above races real network/DB timing, which
    // proves the invariant end-to-end but can't guarantee it exercises
    // the exact interleaving on every run. This test forces that specific
    // interleaving deterministically instead of hoping for it: it lets
    // joinWorkspaceRooms's first membership read execute for real and
    // capture its result (so that result is genuinely a pre-removal
    // snapshot, not a fabricated one), but withholds *resolving* that
    // read back to application code until after removeWorkspaceMember has
    // already committed. That reproduces "a socket joins using a stale
    // snapshot after the removal already happened" using only real await
    // ordering - no sleeps, no timing guesses.
    const originalFindMany = prisma.workspaceMember.findMany.bind(prisma.workspaceMember);
    let patchedCallCount = 0;
    let resolveFirstReadCaptured: () => void;
    let releaseFirstRead: () => void;

    const firstReadCaptured = new Promise<void>((resolve) => {
      resolveFirstReadCaptured = resolve;
    });

    prisma.workspaceMember.findMany = ((...args: Parameters<typeof originalFindMany>) => {
      patchedCallCount++;

      // Only the connecting socket's first read (joinWorkspaceRooms's
      // query1) is intercepted - its second, self-correcting read must
      // run unmodified so it reflects genuinely current state.
      if (patchedCallCount !== 1) {
        return originalFindMany(...args);
      }

      return originalFindMany(...args).then(
        (result) =>
          new Promise<typeof result>((resolveRelease) => {
            releaseFirstRead = () => resolveRelease(result);
            resolveFirstReadCaptured();
          }),
      );
    }) as typeof originalFindMany;

    try {
      const connectPromise = connect(target.cookie);

      // Guarantees the SELECT already executed against Postgres (and
      // therefore reflects the still-present membership) before the
      // removal below is even issued.
      await firstReadCaptured;

      await removeWorkspaceMember(owner.userId, workspace.id, membership.id);

      // Only now does joinWorkspaceRooms's join loop see the (already
      // stale) result and run.
      releaseFirstRead!();

      const socket = await connectPromise;

      // See the equivalent comment in the Promise.all race test above: a
      // single early check can't distinguish "correctly protected" from
      // "the async join/self-correction chain just hasn't finished yet,"
      // since releaseFirstRead() only just resumed it. The retry budget is
      // what gives it real time to settle before this concludes anything.
      await expect(
        waitForEventWithRetries(socket, WORKSPACE_EVENT, () =>
          emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "forbidden" }),
        ),
      ).rejects.toThrow();
    } finally {
      prisma.workspaceMember.findMany = originalFindMany;
    }
  });

  it("joins a workspace room for a membership created between the connecting socket's two membership reads (deterministic)", async () => {
    const owner = await signUpTestUser(app);
    const { workspace: existingWorkspace } = await createWorkspaceWithMember(owner.userId);

    const target = await signUpTestUser(app);
    await addWorkspaceMember(existingWorkspace.id, target.userId, WorkspaceRole.MEMBER);

    // A second, brand-new workspace target is NOT a member of yet - added
    // only after the connecting socket's first membership read has already
    // captured its (necessarily pre-add) snapshot, below.
    const { workspace: newWorkspace } = await createWorkspaceWithMember(owner.userId);

    // Same deterministic interception as the removal race above, mirrored
    // for the opposite direction: joinWorkspaceRooms's first read is let
    // through for real (so it genuinely reflects "not a member of
    // newWorkspace yet"), but its resolution back to application code is
    // withheld until after the new membership has already committed - this
    // reproduces "a membership was created strictly between the two reads"
    // using real await ordering, not a guess about timing.
    const originalFindMany = prisma.workspaceMember.findMany.bind(prisma.workspaceMember);
    let patchedCallCount = 0;
    let resolveFirstReadCaptured: () => void;
    let releaseFirstRead: () => void;

    const firstReadCaptured = new Promise<void>((resolve) => {
      resolveFirstReadCaptured = resolve;
    });

    prisma.workspaceMember.findMany = ((...args: Parameters<typeof originalFindMany>) => {
      patchedCallCount++;

      if (patchedCallCount !== 1) {
        return originalFindMany(...args);
      }

      return originalFindMany(...args).then(
        (result) =>
          new Promise<typeof result>((resolveRelease) => {
            releaseFirstRead = () => resolveRelease(result);
            resolveFirstReadCaptured();
          }),
      );
    }) as typeof originalFindMany;

    try {
      const connectPromise = connect(target.cookie);

      // Guarantees the first SELECT already executed against Postgres (and
      // therefore reflects target not yet being a member of newWorkspace)
      // before the membership below is even created.
      await firstReadCaptured;

      await addWorkspaceMember(newWorkspace.id, target.userId, WorkspaceRole.MEMBER);

      // Only now does joinWorkspaceRooms's initial join loop see the
      // (already stale, pre-add) first-read result and run - the second,
      // unpatched read that follows will see the new membership for real.
      releaseFirstRead!();

      const socket = await connectPromise;

      // Proves actual delivery, not just absence of an error - if the fix
      // regressed back to only joining rooms from the first (stale) read,
      // this would time out, since the socket would never have joined
      // newWorkspace's room at all.
      await confirmJoined(socket, newWorkspace.id);
    } finally {
      prisma.workspaceMember.findMany = originalFindMany;
    }
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
