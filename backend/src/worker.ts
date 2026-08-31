import "dotenv/config";

import { registerFatalErrorHandlers } from "./lib/fatal-error-handler.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { createShutdownGate } from "./lib/shutdown-gate.js";
import { registerDemoCleanupSchedule } from "./queues/demo-cleanup/demo-cleanup.queue.js";
import { closeDemoCleanupWorker } from "./queues/demo-cleanup/demo-cleanup.worker.js";
import { closeEmailWorker } from "./queues/email/email.worker.js";
import { closeNotificationWorker } from "./queues/notification/notification.worker.js";

const shutdownGate = createShutdownGate();

/**
 * exitCode defaults to 0 for the normal SIGTERM/SIGINT path below. A fatal
 * uncaughtException/unhandledRejection (see registerFatalErrorHandlers
 * below) calls this with 1 instead - see server.ts's identical shutdown()
 * for the full reasoning (same shutdownGate, same exit-code-upgrade
 * behavior).
 *
 * Unlike server.ts's shutdown() - where a step throwing skips later steps
 * entirely - each cleanup step here is independently try/caught: the email
 * worker, the notification worker, and Prisma are three unrelated
 * connections, so one failing to close must not stop an attempt to close
 * the other two. notification.worker.ts's job processor uses the same
 * shared `prisma` singleton server.ts uses, so leaving it connected on a
 * worker close failure would leak the connection exactly like an unclean
 * server shutdown would.
 */
async function shutdown(exitCode = 0): Promise<void> {
  if (!shutdownGate.requestShutdown(exitCode)) {
    return;
  }

  logger.info("Shutting down workers...");

  let shutdownError: unknown;

  try {
    await closeEmailWorker();
  } catch (error) {
    shutdownError = error;
    logger.error({ err: error }, "Email worker shutdown failed");
  }

  try {
    await closeNotificationWorker();
  } catch (error) {
    shutdownError = shutdownError ?? error;
    logger.error({ err: error }, "Notification worker shutdown failed");
  }

  try {
    await closeDemoCleanupWorker();
  } catch (error) {
    shutdownError = shutdownError ?? error;
    logger.error({ err: error }, "Demo cleanup worker shutdown failed");
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    shutdownError = shutdownError ?? error;
    logger.error({ err: error }, "Prisma disconnect failed");
  }

  if (!shutdownError) {
    logger.info("Workers shut down successfully.");
  }

  process.exit(Math.max(shutdownError ? 1 : 0, shutdownGate.getExitCode()));
}

function registerShutdownHandlers(): void {
  process.on("SIGTERM", () => {
    void shutdown();
  });

  process.on("SIGINT", () => {
    void shutdown();
  });
}

registerShutdownHandlers();

registerFatalErrorHandlers({
  process,
  shutdown,
});

// Registered after shutdown/fatal-error handlers are already wired, so a
// failure here can't leave the process without them. Non-fatal on its own
// failure: this only schedules the recurring cleanup job (see
// queues/demo-cleanup/demo-cleanup.queue.ts) - if it fails, demo cleanup
// simply doesn't run until the next successful worker restart, not a
// reason to crash a process that also handles email/notification jobs.
try {
  await registerDemoCleanupSchedule();
} catch (error) {
  logger.error({ err: error }, "Failed to register demo cleanup schedule");
}