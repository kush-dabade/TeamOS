import "dotenv/config";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import app from "./app.js";
import { registerFatalErrorHandlers } from "./lib/fatal-error-handler.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { createShutdownGate } from "./lib/shutdown-gate.js";
import { markShuttingDown } from "./lib/shutdown-state.js";
import {
  closeNotificationQueueEvents,
  initializeNotificationQueueEvents,
} from "./queues/notification/index.js";
import { closeRealtime, initializeRealtime } from "./realtime/index.js";

const PORT = process.env.PORT || 3000;

const shutdownGate = createShutdownGate();

/**
 * exitCode defaults to 0 for the normal SIGTERM/SIGINT path below. A fatal
 * uncaughtException/unhandledRejection (see registerFatalErrorHandlers in
 * start()) calls this with 1 instead - same cleanup sequence either way,
 * only the final exit status differs, since a fatal error means the
 * process must not report a clean exit even if shutdown itself completes
 * without error.
 *
 * If a fatal error fires while a SIGTERM-triggered shutdown is already in
 * progress, shutdownGate still only lets the cleanup sequence below run
 * once (idempotent), but it upgrades the exit code process.exit()
 * eventually uses to the highest one requested across every call - a
 * fatal error can never get silently downgraded to a clean 0 exit just
 * because a graceful shutdown happened to already be in flight.
 */
export async function shutdown(
  server: ReturnType<typeof createServer>,
  exitCode = 0,
): Promise<void> {
  // Set before the shutdown-gate check below, and before any other line in
  // this function - /ready must start reporting 503 immediately on the
  // first shutdown signal, even a redundant one that the gate below is
  // about to no-op.
  markShuttingDown();

  if (!shutdownGate.requestShutdown(exitCode)) {
    return;
  }

  logger.info("Shutting down TeamOS API...");

  // Stops the server accepting new connections, but its callback only
  // fires once every existing connection has ended - including any
  // long-lived Socket.IO WebSocket connections, which never end on their
  // own. The old code awaited this callback before doing anything else,
  // which deadlocked: closeRealtime() below is what actually terminates
  // those connections, so nothing would ever make this callback fire.
  // Calling it here without waiting on it still stops new connections
  // immediately and logs a genuine close error if one occurs; closeRealtime()'s
  // own io.close() closes this same underlying http.Server a second time
  // once it has forcibly disconnected every socket (Socket.IO was attached
  // to it via `new Server(server, ...)` in initializeRealtime). Node allows
  // a second close() call while the first is still pending - it just adds
  // another listener for the same eventual "close" event - so the two
  // calls don't conflict.
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Error closing HTTP server");
    }
  });

  try {
    await closeRealtime();
    await closeNotificationQueueEvents();
    await prisma.$disconnect();

    logger.info("Shutdown completed successfully.");

    process.exit(shutdownGate.getExitCode());
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
}

function registerShutdownHandlers(
  server: ReturnType<typeof createServer>,
): void {
  process.on("SIGTERM", () => {
    void shutdown(server);
  });

  process.on("SIGINT", () => {
    void shutdown(server);
  });
}

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    logger.info("Database connected");

    const server = createServer(app);

    initializeRealtime(server);
    initializeNotificationQueueEvents();

    registerShutdownHandlers(server);

    registerFatalErrorHandlers({
      process,
      shutdown: (exitCode) => shutdown(server, exitCode),
    });

    server.on("error", (error) => {
      logger.error({ err: error }, "Server error");
      process.exit(1);
    });

    server.listen(PORT, () => {
      logger.info({ port: PORT }, "TeamOS API running");
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
  }
}

// Guards the real boot sequence (listening on PORT, connecting to the real
// Prisma/Redis, registering process-wide SIGTERM/SIGINT handlers) so that
// importing this module elsewhere - e.g. a test importing shutdown() - does
// not also start a second real server as a side effect.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  start().catch((error) => {
    logger.error({ err: error }, "Unhandled error during startup");
    process.exit(1);
  });
}
