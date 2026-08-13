import "dotenv/config";

import { registerFatalErrorHandlers } from "./lib/fatal-error-handler.js";
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
 */
async function shutdown(exitCode = 0): Promise<void> {
  if (!shutdownGate.requestShutdown(exitCode)) {
    return;
  }

  console.log("Shutting down workers...");

  try {
    await closeEmailWorker();
    await closeNotificationWorker();

    console.log("Workers shut down successfully.");

    process.exit(shutdownGate.getExitCode());
  } catch (error) {
    console.error("Worker shutdown failed:", error);
    process.exit(1);
  }
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