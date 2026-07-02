import "dotenv/config";

import { closeEmailWorker } from "./queues/email/email.worker.js";
import { closeNotificationWorker } from "./queues/notification/notification.worker.js";

let isShuttingDown = false;

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log("Shutting down workers...");

  try {
    await closeEmailWorker();
    await closeNotificationWorker();

    console.log("Workers shut down successfully.");

    process.exit(0);
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