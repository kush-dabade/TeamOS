import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { trustedOrigins } from "../../src/config/security.config.js";
import { REALTIME_EVENTS } from "../../src/realtime/realtime.constants.js";
import { emitToWorkspace } from "../../src/realtime/realtime.emitter.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";
import { connectTestSocket, waitForEventWithRetries } from "../setup/socket-client.js";

/**
 * Confirms Commits 5/6 (rate limiting, security headers) didn't break
 * pre-existing cross-cutting behavior. Deliberately thin - Commit 4's own
 * suite already exhaustively covers realtime workspace isolation, so this
 * only proves a connection still succeeds, not the full isolation matrix
 * again.
 */
describe("Commit 5/6 regression coverage", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await resetDatabase();
    // The Better-Auth-signup check below also hits /api/v1/workspaces,
    // which passes through the general limiter (mounted at /api/v1 in
    // app.ts) - its Redis counter is cleared automatically by the global
    // afterEach in tests/setup/rate-limit-cleanup-hook.ts.
  });

  it("still returns the expected CORS headers for a trusted origin", async () => {
    const origin = trustedOrigins[0];

    if (!origin) {
      throw new Error("Expected at least one configured trusted origin for this check.");
    }

    const res = await request(app).get("/health").set("Origin", origin).expect(200);

    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("still signs up a real user through Better Auth with a usable session", async () => {
    const { userId, cookie } = await signUpTestUser(app);

    expect(userId).toBeTruthy();
    expect(cookie).toBeTruthy();

    await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(200);
  });

  it("still authenticates and delivers events over a real Socket.IO connection", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(userId);

    const socket = await connectTestSocket(server.baseUrl, cookie);

    try {
      await waitForEventWithRetries(socket, REALTIME_EVENTS.TASK_CREATED, () =>
        emitToWorkspace(workspace.id, REALTIME_EVENTS.TASK_CREATED, { marker: "regression-check" }),
      );
    } finally {
      socket.disconnect();
    }
  });
});
