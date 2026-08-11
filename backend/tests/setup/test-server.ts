import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import app from "../../src/app.js";
import { closeRealtime, initializeRealtime } from "../../src/realtime/index.js";

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * Boots the real app the same way src/server.ts does - createServer(app),
 * initializeRealtime(server), listening on an ephemeral port - but does
 * NOT call initializeNotificationQueueEvents() or start any BullMQ worker.
 * This harness is for request/response API and Socket.IO tests only, not
 * background job processing.
 *
 * realtime/realtime.server.ts's `io` is a module-level singleton, so this
 * supports one server per test file (call once in beforeAll, close once in
 * afterAll) - not multiple concurrent servers within the same file. Vitest
 * isolates each test file into its own worker by default, so separate
 * files don't share this singleton.
 */
export async function startTestServer(): Promise<TestServer> {
  const server = createServer(app);

  initializeRealtime(server);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://localhost:${port}`,
    // closeRealtime() already closes the underlying http.Server itself -
    // Socket.IO's Server.close() awaits httpServer.close() internally,
    // since initializeRealtime() attached it via `new Server(server, ...)`.
    // A second, separate server.close() call here would just double-close
    // an already-closed server and throw "Server is not running".
    close: closeRealtime,
  };
}
