import { afterAll, describe, expect, it, vi } from "vitest";

import app from "../../src/app.js";
import { shutdown } from "../../src/server.js";

import { resetDatabase } from "../setup/reset-database.js";
import { signUpTestUser } from "../setup/fixtures.js";
import { connectTestSocket } from "../setup/socket-client.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";

const BOUND_MS = 3000;

// The timer handle is retained and explicitly cleared once the race
// settles - regardless of whether `promise` resolves, `promise` rejects, or
// the timeout itself wins - so a fast-settling `promise` doesn't leave this
// timeout still pending in the background for the remainder of BOUND_MS.
function boundedBy<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} did not settle within ${BOUND_MS}ms`)),
      BOUND_MS,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Reproduces the exact scenario server.ts's shutdown() used to deadlock on:
 * a real, still-open Socket.IO WebSocket connection at the moment shutdown
 * begins. Before the fix, server.close()'s callback - which the old code
 * awaited before doing anything else, including closeRealtime() - would
 * never fire while this connection stayed open, since nothing forced it to
 * end. This test's own timeout (the race in boundedBy, not Vitest's global
 * testTimeout) is what actually proves the deadlock is gone: it fails fast
 * and specifically if shutdown() ever hangs again, rather than only
 * surfacing as a generic suite-wide timeout.
 */
describe("graceful shutdown with an active realtime connection", () => {
  let testServer: TestServer;

  afterAll(async () => {
    await testServer?.close();
  });

  it("terminates the open socket and completes shutdown within a bounded time, exactly once", async () => {
    testServer = await startTestServer();

    const user = await signUpTestUser(app);
    const socket = await connectTestSocket(testServer.baseUrl, user.cookie);

    // No further DB activity happens after this - resetDatabase() must run
    // before shutdown() disconnects this test file's Prisma client, not
    // after, since resetDatabase() itself needs a live connection.
    await resetDatabase();

    const clientDisconnected = new Promise<string>((resolve) => {
      socket.once("disconnect", resolve);
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    try {
      const startedAt = Date.now();

      const [disconnectReason] = await boundedBy(
        Promise.all([clientDisconnected, shutdown(testServer.server, 0)]),
        "socket disconnect + shutdown",
      );

      expect(Date.now() - startedAt).toBeLessThan(BOUND_MS);
      expect(typeof disconnectReason).toBe("string");
      expect(disconnectReason.length).toBeGreaterThan(0);

      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Idempotency: shutdownGate is a module-level singleton in server.ts,
      // so this exercises the real gate end-to-end (not just the pure unit
      // covered by shutdown-gate.test.ts) - a second shutdown() call must
      // return immediately without running cleanup again or exiting again.
      await shutdown(testServer.server, 1);

      expect(exitSpy).toHaveBeenCalledTimes(1);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
