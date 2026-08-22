import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Socket } from "socket.io-client";

import app from "../../src/app.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToUser } from "../../src/realtime/realtime.emitter.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { signUpTestUser } from "../setup/fixtures.js";
import { connectTestSocket, waitForEvent, waitForEventWithRetries } from "../setup/socket-client.js";

const USER_ROOM_SENTINEL = REALTIME_EVENTS.NOTIFICATION_CREATED;

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
