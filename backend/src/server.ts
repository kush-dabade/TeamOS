import "dotenv/config";
import { createServer } from "node:http";

import app from "./app.js";
import { registerFatalErrorHandlers } from "./lib/fatal-error-handler.js";
import { prisma } from "./lib/prisma.js";
import { createShutdownGate } from "./lib/shutdown-gate.js";
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
async function shutdown(
  server: ReturnType<typeof createServer>,
  exitCode = 0,
): Promise<void> {
  if (!shutdownGate.requestShutdown(exitCode)) {
    return;
  }

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

      process.exit(shutdownGate.getExitCode());
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
