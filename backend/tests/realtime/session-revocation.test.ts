import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Socket } from "socket.io-client";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToUser, emitToWorkspace } from "../../src/realtime/realtime.emitter.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";
import {
  connectTestSocket,
  trackEvent,
  waitForEvent,
  waitForEventWithRetries,
} from "../setup/socket-client.js";

const USER_ROOM_SENTINEL = REALTIME_EVENTS.NOTIFICATION_CREATED;
const WORKSPACE_EVENT = REALTIME_EVENTS.TASK_CREATED;

/**
 * Signs in again for an already-verified user, returning a second,
 * independent session cookie - signUpTestUser always creates a brand new
 * user, so proving session-scoped (not user-scoped) eviction needs a second
 * concurrent session for the SAME user (the laptop+phone scenario). Mirrors
 * signUpTestUser's own cookie extraction.
 */
async function signInAgain(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email, password })
    .expect(200);

  const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;

  if (!setCookie || setCookie.length === 0) {
    throw new Error("Sign-in did not return a session cookie");
  }

  return setCookie.map((entry) => entry.split(";")[0]).join("; ");
}

describe("realtime session-scoped revocation", () => {
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

  /**
   * Proves a socket is genuinely alive and its user room joined, using the
   * same retry-until-observed liveness check workspace-room-isolation.test.ts
   * relies on for the equivalent connect-vs-join race.
   */
  function confirmAlive(socket: Socket, userId: string) {
    return waitForEventWithRetries(socket, USER_ROOM_SENTINEL, () =>
      emitToUser(userId, USER_ROOM_SENTINEL, { marker: "confirm-alive" }),
    );
  }

  it("disconnects the socket when its own session signs out, through the real Better Auth hook", async () => {
    const user = await signUpTestUser(app);
    const socket = await connect(user.cookie);

    await confirmAlive(socket, user.userId);

    // Registered before the triggering call, not after - sign-out can
    // disconnect the socket before its own HTTP response resolves, so
    // awaiting listeners registered afterward would only pass because of
    // favorable event-loop scheduling, not a guaranteed ordering.
    const revocationEvent = waitForEvent<{ sessionId: string }>(
      socket,
      REALTIME_EVENTS.SESSION_REVOKED,
    );
    const disconnectEvent = waitForEvent(socket, "disconnect");

    await request(app).post("/api/auth/sign-out").set("Cookie", user.cookie).expect(200);

    await revocationEvent;
    await disconnectEvent;

    expect(socket.connected).toBe(false);

    // The session row is genuinely gone, not just the socket - a subsequent
    // request against the same (now-revoked) cookie has no session.
    const sessionRes = await request(app)
      .get("/api/auth/get-session")
      .set("Cookie", user.cookie);

    expect(sessionRes.body).toBeNull();
  });

  it("revoking one session does not disconnect a second session for the same user", async () => {
    const user = await signUpTestUser(app);

    const cookieB = await signInAgain(user.email, user.password);

    const socketA = await connect(user.cookie);
    const socketB = await connect(cookieB);

    await Promise.all([confirmAlive(socketA, user.userId), confirmAlive(socketB, user.userId)]);

    const revocationEventA = waitForEvent<{ sessionId: string }>(
      socketA,
      REALTIME_EVENTS.SESSION_REVOKED,
    );
    const disconnectEventA = waitForEvent(socketA, "disconnect");

    await request(app).post("/api/auth/sign-out").set("Cookie", user.cookie).expect(200);

    await revocationEventA;
    await disconnectEventA;

    expect(socketA.connected).toBe(false);

    // Not just "still connected" by flag - prove socket B is actually
    // usable by round-tripping a real event through it after the sibling
    // session was revoked.
    await confirmAlive(socketB, user.userId);
    expect(socketB.connected).toBe(true);
  });

  it("rejects a new connection attempt made with an already-revoked session", async () => {
    const user = await signUpTestUser(app);

    await request(app).post("/api/auth/sign-out").set("Cookie", user.cookie).expect(200);

    // Regression guarantee, not new behavior - authenticateSocket() already
    // calls auth.api.getSession() fresh on every connection attempt, which
    // already rejects a token whose session row no longer exists.
    await expect(connectTestSocket(server.baseUrl, user.cookie)).rejects.toThrow();
  });

  it("disconnects every socket authenticated with the revoked session, not just one", async () => {
    const user = await signUpTestUser(app);

    const socketA = await connect(user.cookie);
    const socketB = await connect(user.cookie);

    await Promise.all([confirmAlive(socketA, user.userId), confirmAlive(socketB, user.userId)]);

    const revocationEventA = waitForEvent<{ sessionId: string }>(
      socketA,
      REALTIME_EVENTS.SESSION_REVOKED,
    );
    const revocationEventB = waitForEvent<{ sessionId: string }>(
      socketB,
      REALTIME_EVENTS.SESSION_REVOKED,
    );
    const disconnectEventA = waitForEvent(socketA, "disconnect");
    const disconnectEventB = waitForEvent(socketB, "disconnect");

    await request(app).post("/api/auth/sign-out").set("Cookie", user.cookie).expect(200);

    await Promise.all([revocationEventA, revocationEventB]);
    await Promise.all([disconnectEventA, disconnectEventB]);

    expect(socketA.connected).toBe(false);
    expect(socketB.connected).toBe(false);
  });
});

describe("realtime passive session expiry", () => {
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

  /**
   * Signs in with rememberMe: false, which makes Better Auth set its own
   * signed "dont_remember" cookie alongside the session cookie. That's what
   * makes a later getSession() call (session.mjs) skip its own rolling-
   * refresh check entirely (`if (dontRememberMe || ...) return without
   * refresh`) - without it, getSession() treats ANY session whose expiresAt
   * looks close (relative to expiresIn/updateAge) as "due for refresh" and
   * silently resets it back out to a fresh 7-day expiresAt, which would
   * otherwise undo this describe block's own "shorten expiresAt via a
   * direct Prisma update" fixture technique the instant authenticateSocket
   * calls getSession() during the handshake - confirmed empirically: the
   * first version of this test, without this, timed out waiting for
   * SESSION_REVOKED because the session was silently refreshed back to a
   * ~7-day expiry before scheduleSessionExpiry ever ran.
   */
  async function signInWithoutRefresh(email: string, password: string): Promise<string> {
    const response = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password, rememberMe: false })
      .expect(200);

    const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;

    if (!setCookie || setCookie.length === 0) {
      throw new Error("Sign-in did not return a session cookie");
    }

    return setCookie.map((entry) => entry.split(";")[0]).join("; ");
  }

  it("disconnects the socket when its session's expiresAt passes, with no further HTTP activity", async () => {
    const user = await signUpTestUser(app);

    // signUpTestUser's own sign-in cookie is unused here on purpose - its
    // session would hit the rolling-refresh problem signInWithoutRefresh's
    // own doc comment explains. Only its side effect (an email-verified
    // account with a known password) is needed.
    const cookie = await signInWithoutRefresh(user.email, user.password);

    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
    });

    // Direct Prisma override, same "shorten a real, legitimately-signed
    // session's TTL for deterministic test timing" technique
    // createActivityDirect already uses for createdAt - the cookie itself
    // is untouched (its signature is over the token, not expiresAt), so
    // authenticateSocket's real getSession() call still accepts it at
    // connect time; only how soon it expires changes.
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + 300) },
    });

    const socket = await connect(cookie);

    // Registered before connecting would be impossible here (the socket
    // doesn't exist yet) - registered immediately after instead, which is
    // still well before the 300ms window can elapse.
    const revocationEvent = waitForEvent<{ sessionId: string }>(
      socket,
      REALTIME_EVENTS.SESSION_REVOKED,
    );
    const disconnectEvent = waitForEvent(socket, "disconnect");

    const revoked = await revocationEvent;
    await disconnectEvent;

    expect(revoked.sessionId).toBe(session.id);
    expect(socket.connected).toBe(false);
  });

  it("does not act on a socket that already disconnected on its own before expiry", async () => {
    const user = await signUpTestUser(app);

    // See signInWithoutRefresh's own doc comment above for why the plain
    // signUpTestUser cookie can't be used to connect in this describe block.
    const cookie = await signInWithoutRefresh(user.email, user.password);

    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + 300) },
    });

    const socket = await connect(cookie);
    const disconnectEvent = waitForEvent<string>(socket, "disconnect");

    socket.disconnect();

    const reason = await disconnectEvent;

    expect(reason).toBe("io client disconnect");
    expect(socket.connected).toBe(false);

    // A disconnected client can't observe anything the server does to it
    // afterward (no transport left), so there is no positive event to wait
    // for here - the only way to prove the server's expiry timer was
    // actually cleared (Case A) rather than merely harmless is to give it
    // the same real window it would have needed to misbehave in and confirm
    // nothing does. This is a real, bounded wait tied to a known timer
    // window, not an arbitrary sleep - the same category of technique
    // workspace-room-isolation.test.ts's cross-workspace isolation test
    // uses to prove a negative. What it cannot prove on its own, by
    // construction, is that the underlying setTimeout *handle* was
    // released - only that nothing observable goes wrong. See this
    // commit's own report for that caveat.
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(socket.connected).toBe(false);
  });

  it("rejects a connection attempt whose session already expired before the handshake", async () => {
    const user = await signUpTestUser(app);

    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.userId },
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // Better Auth's own getSession() (invoked from authenticateSocket, the
    // Socket.IO auth middleware) already rejects a session whose expiresAt
    // has passed *before* the handshake completes - proven directly here
    // rather than assumed. scheduleSessionExpiry's own already-expired
    // branch in realtime.server.ts exists for the much narrower race window
    // between that check succeeding and the timer being scheduled, which
    // isn't independently reproducible through the public HTTP/Socket.IO
    // surface without reaching into realtime.server.ts's internals - this
    // test documents that boundary rather than forcing it artificially.
    await expect(connectTestSocket(server.baseUrl, user.cookie)).rejects.toThrow();
  });
});

describe("realtime handshake-to-eviction race", () => {
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

  it(
    "does not join workspace rooms when the session is deleted while connection setup is " +
      "paused at its final revalidation check (deterministic race)",
    async () => {
      const user = await signUpTestUser(app);
      const { workspace } = await createWorkspaceWithMember(user.userId);

      // Deterministically reproduces "the session was deleted strictly
      // between authenticateSocket() validating it and this socket's own
      // final revalidation query running" - the exact race described in the
      // review - using real await ordering instead of a sleep. Intercepts
      // isSessionStillActive's own prisma.session.findUnique call (the only
      // caller of that method anywhere in the connection path - Better
      // Auth's own session lookups go through findFirst, verified against
      // the installed @better-auth/prisma-adapter) *before* it reaches
      // Postgres, not after: the deletion below must commit before the real
      // query underneath this interception ever runs, so the query's own
      // result (not a forced/fabricated one) is what proves this case,
      // mirroring workspace-room-isolation.test.ts's identical
      // capture-then-release technique for its own deterministic race test.
      const originalFindUnique = prisma.session.findUnique.bind(prisma.session);
      let resolveQueryAboutToRun: () => void;
      let releaseQuery: () => void;

      const queryAboutToRun = new Promise<void>((resolve) => {
        resolveQueryAboutToRun = resolve;
      });
      const queryReleased = new Promise<void>((resolve) => {
        releaseQuery = resolve;
      });

      prisma.session.findUnique = (async (
        ...args: Parameters<typeof originalFindUnique>
      ) => {
        resolveQueryAboutToRun();
        await queryReleased;
        return originalFindUnique(...args);
      }) as unknown as typeof originalFindUnique;

      try {
        // Not awaited yet - the client's own "connect" event fires once
        // Socket.IO's internal handshake ack is sent, which happens before
        // this server's connection handler (and therefore its paused
        // revalidation query) even starts running, so awaiting this now
        // would resolve before the pause point is reached.
        const connectPromise = connect(user.cookie);

        // Guarantees isSessionStillActive's query has actually started -
        // meaning joinUserRoom() already ran (see realtime.server.ts's
        // ordering) but joinWorkspaceRooms() has not - before the deletion
        // below.
        await queryAboutToRun;

        const session = await prisma.session.findFirstOrThrow({
          where: { userId: user.userId },
        });

        // A raw Prisma delete, not POST /api/auth/sign-out - deliberately
        // bypasses Better Auth's databaseHooks.session.delete.after
        // entirely, so evictUserSession() never runs for this session. That
        // isolates this test to proving the NEW final-revalidation check
        // alone closes the race, independent of the pre-existing eviction
        // hook (already covered by the "realtime session-scoped revocation"
        // suite above).
        await prisma.session.delete({ where: { id: session.id } });

        // Only now does the paused query resolve, and it resolves to null
        // for real - the row is genuinely gone by the time it runs.
        releaseQuery!();

        const socket = await connectPromise;

        const revocationEvent = waitForEvent<{ sessionId: string }>(
          socket,
          REALTIME_EVENTS.SESSION_REVOKED,
        );
        const disconnectEvent = waitForEvent(socket, "disconnect");

        const revoked = await revocationEvent;
        await disconnectEvent;

        expect(revoked.sessionId).toBe(session.id);
        expect(socket.connected).toBe(false);

        // The socket is now fully disconnected on both ends, which Socket.IO
        // guarantees removes it from every room it was in - but this socket
        // was never joined to the workspace room in the first place, since
        // registerConnectionHandlers returns immediately after
        // revokeSocketSession without ever calling joinWorkspaceRooms(). A
        // broadcast to that room synchronously iterates its current members
        // on the in-memory adapter, so this assertion needs no wait: there
        // is no member to deliver to, and no transport left to deliver
        // through even if there were.
        const forbidden = trackEvent(socket, WORKSPACE_EVENT);
        emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "forbidden" });
        expect(forbidden.wasReceived()).toBe(false);
        forbidden.stop();
      } finally {
        prisma.session.findUnique = originalFindUnique;
      }
    },
  );

  it("rejects a connection whose session is already expired by the final revalidation check", async () => {
    const user = await signUpTestUser(app);

    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.userId },
    });

    // Pauses the same query as above, but this time lets the row survive -
    // only its expiresAt is moved into the past while the connection is
    // paused, exercising isSessionStillActive's `expiresAt > now` branch
    // specifically (Case C), as distinct from the "row is gone entirely"
    // case the test above covers.
    const originalFindUnique = prisma.session.findUnique.bind(prisma.session);
    let resolveQueryAboutToRun: () => void;
    let releaseQuery: () => void;

    const queryAboutToRun = new Promise<void>((resolve) => {
      resolveQueryAboutToRun = resolve;
    });
    const queryReleased = new Promise<void>((resolve) => {
      releaseQuery = resolve;
    });

    prisma.session.findUnique = (async (
      ...args: Parameters<typeof originalFindUnique>
    ) => {
      resolveQueryAboutToRun();
      await queryReleased;
      return originalFindUnique(...args);
    }) as unknown as typeof originalFindUnique;

    try {
      const connectPromise = connect(user.cookie);

      await queryAboutToRun;

      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      releaseQuery!();

      const socket = await connectPromise;

      const revocationEvent = waitForEvent<{ sessionId: string }>(
        socket,
        REALTIME_EVENTS.SESSION_REVOKED,
      );
      const disconnectEvent = waitForEvent(socket, "disconnect");

      await revocationEvent;
      await disconnectEvent;

      expect(socket.connected).toBe(false);
    } finally {
      prisma.session.findUnique = originalFindUnique;
    }
  });

  it("still joins workspace rooms normally when the session remains valid through the revalidation check", async () => {
    const user = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(user.userId);

    // No interception here - this is the control case, proving the new
    // revalidation check isn't just unconditionally rejecting every
    // connection.
    const socket = await connect(user.cookie);

    await waitForEventWithRetries(socket, WORKSPACE_EVENT, () =>
      emitToWorkspace(workspace.id, WORKSPACE_EVENT, { marker: "confirm-joined" }),
    );

    expect(socket.connected).toBe(true);
  });
});

describe("realtime session expiry resync on rolling refresh", () => {
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

  function confirmAlive(socket: Socket, userId: string) {
    return waitForEventWithRetries(socket, USER_ROOM_SENTINEL, () =>
      emitToUser(userId, USER_ROOM_SENTINEL, { marker: "confirm-alive" }),
    );
  }

  it(
    "keeps the socket connected past its original expiry after a real Better Auth rolling " +
      "refresh extends the persisted session",
    async () => {
      // signUpTestUser signs in without passing rememberMe, so Better
      // Auth's own default (true) applies and no `dont_remember` cookie is
      // set - unlike the passive-expiry suite above, this test specifically
      // needs getSession()'s rolling-refresh check to run, not be skipped.
      const user = await signUpTestUser(app);

      const session = await prisma.session.findFirstOrThrow({
        where: { userId: user.userId },
      });

      // Shortens the persisted session via the same direct-Prisma technique
      // the passive-expiry suite above already uses, but for the opposite
      // purpose: this needs to land inside Better Auth's own "due for
      // refresh" window (expiresAt <= now + expiresIn - updateAge = now + 6
      // days - see session.mjs's shouldBeUpdated) while still being close
      // enough in wall-clock terms that this test can prove, within a few
      // real seconds, that the socket's own timer survived past it.
      const originalExpiresAt = new Date(Date.now() + 3000);

      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: originalExpiresAt },
      });

      const socket = await connect(user.cookie);
      await confirmAlive(socket, user.userId);

      // A real, authenticated HTTP request against this exact session -
      // not a simulated refresh - is what actually drives Better Auth's
      // own rolling-refresh logic and, through it, this PR's
      // databaseHooks.session.update.after hook.
      const refreshResponse = await request(app)
        .get("/api/auth/get-session")
        .set("Cookie", user.cookie)
        .expect(200);

      const refreshedExpiresAt = new Date(
        (refreshResponse.body as { session: { expiresAt: string } }).session.expiresAt,
      );

      // Proves the refresh actually happened, not just that the request
      // succeeded - a still-imminent expiresAt here would mean Better Auth
      // didn't refresh, and the rest of this test wouldn't be exercising
      // anything.
      expect(refreshedExpiresAt.getTime()).toBeGreaterThan(originalExpiresAt.getTime());

      const persisted = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
      expect(persisted.expiresAt.getTime()).toBe(refreshedExpiresAt.getTime());

      // The actual regression proof. Without
      // databaseHooks.session.update.after rescheduling this socket's timer,
      // it would still be pinned to originalExpiresAt (3s out) and disconnect
      // right about now regardless of the refresh above having succeeded.
      // There's no positive event to await for "the stale timer did not
      // fire" - this real, bounded wait past the original deadline is the
      // same category of negative proof session-revocation.test.ts's own
      // passive-expiry suite already relies on ("does not act on a socket
      // that already disconnected on its own before expiry"), not an
      // arbitrary sleep standing in for real synchronization.
      await new Promise((resolve) => setTimeout(resolve, 3500));

      expect(socket.connected).toBe(true);

      // Not just "the connected flag is still true" - proves the socket is
      // actually usable, by round-tripping a real event through it after
      // the point it would have been wrongly disconnected.
      await confirmAlive(socket, user.userId);
    },
  );

  it("still refreshes the session over HTTP when the user has no realtime socket connected", async () => {
    const user = await signUpTestUser(app);

    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.userId },
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + 3000) },
    });

    // No socket connection for this user - rescheduleUserSessionExpiry's
    // own user-room lookup resolves to an empty array, exercising the
    // hook's best-effort no-op path. The request must still succeed: this
    // hook must never be able to fail the HTTP request that triggered it.
    const response = await request(app)
      .get("/api/auth/get-session")
      .set("Cookie", user.cookie)
      .expect(200);

    const body = response.body as { session: { expiresAt: string } };

    expect(new Date(body.session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
