import "dotenv/config";
import { createServer } from "node:http";

import app from "./app.js";
import { registerFatalErrorHandlers } from "./lib/fatal-error-handler.js";
import { prisma } from "./lib/prisma.js";
import {
  closeNotificationQueueEvents,
  initializeNotificationQueueEvents,
} from "./queues/notification/index.js";
import { closeRealtime, initializeRealtime } from "./realtime/index.js";

const PORT = process.env.PORT || 3000;

let isShuttingDown = false;

/**
 * exitCode defaults to 0 for the normal SIGTERM/SIGINT path below. A fatal
 * uncaughtException/unhandledRejection (see registerFatalErrorHandlers in
 * start()) calls this with 1 instead - same cleanup sequence either way,
 * only the final exit status differs, since a fatal error means the
 * process must not report a clean exit even if shutdown itself completes
 * without error.
 *
 * If a fatal error fires while a SIGTERM-triggered shutdown is already in
 * progress, the isShuttingDown guard below means this second call returns
 * immediately without upgrading the exit code to 1. Deliberately not
 * handled further - the already-in-progress graceful shutdown still runs
 * to completion and Docker's restart policy recovers the container either
 * way, so adding state to cover this doesn't change the operational
 * outcome, just the exit code of an already-shutting-down process.
 */
async function shutdown(
  server: ReturnType<typeof createServer>,
  exitCode = 0,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log("Shutting down TeamOS API...");

  server.close(async (error) => {
    if (error) {
      console.error("Error closing HTTP server:", error);
      process.exit(1);
    }

    try {
      await closeRealtime();
      await closeNotificationQueueEvents();
      await prisma.$disconnect();

      console.log("Shutdown completed successfully.");

      process.exit(exitCode);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });
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

    console.log("Database connected");

    const server = createServer(app);

    initializeRealtime(server);
    initializeNotificationQueueEvents();

    registerShutdownHandlers(server);

    registerFatalErrorHandlers({
      process,
      shutdown: (exitCode) => shutdown(server, exitCode),
    });

    server.on("error", (error) => {
      console.error("Server error:", error);
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(`TeamOS API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start().catch((error) => {
  console.error("Unhandled error during startup:", error);
  process.exit(1);
});
