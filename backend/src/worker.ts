import "dotenv/config";

import { registerFatalErrorHandlers } from "./lib/fatal-error-handler.js";
import { prisma } from "./lib/prisma.js";
import { createShutdownGate } from "./lib/shutdown-gate.js";
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

  console.log("Shutting down workers...");

  let shutdownError: unknown;

  try {
    await closeEmailWorker();
  } catch (error) {
    shutdownError = error;
    console.error("Email worker shutdown failed:", error);
  }

  try {
    await closeNotificationWorker();
  } catch (error) {
    shutdownError = shutdownError ?? error;
    console.error("Notification worker shutdown failed:", error);
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    shutdownError = shutdownError ?? error;
    console.error("Prisma disconnect failed:", error);
  }

  if (!shutdownError) {
    console.log("Workers shut down successfully.");
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