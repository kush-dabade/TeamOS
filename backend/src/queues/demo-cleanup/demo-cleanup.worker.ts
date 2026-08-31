import { Worker } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";
import { logger } from "../../lib/logger.js";
import { cleanupExpiredDemoSessions } from "../../modules/demo/demo-cleanup.service.js";
import { QUEUE_NAMES } from "../queue.constants.js";

import { DEMO_CLEANUP_JOB_NAME } from "./demo-cleanup.queue.js";

export const demoCleanupWorker = new Worker(
  QUEUE_NAMES.DEMO_CLEANUP,
  async (job) => {
    switch (job.name) {
      case DEMO_CLEANUP_JOB_NAME:
        return await cleanupExpiredDemoSessions();

      default:
        throw new Error(`Unknown demo cleanup job: ${job.name}`);
    }
  },
  {
    connection: redisConfig,
    concurrency: 1,
  },
);

demoCleanupWorker.on("ready", () => {
  logger.info("Demo cleanup worker is ready.");
});

demoCleanupWorker.on("completed", (job) => {
  logger
    .child({ jobId: job.id, jobName: job.name })
    .info({ result: job.returnvalue }, "Completed demo cleanup job");
});

demoCleanupWorker.on("failed", (job, error) => {
  logger
    .child({ jobId: job?.id ?? "unknown", jobName: job?.name ?? "unknown" })
    .error({ err: error }, "Demo cleanup job failed");
});

demoCleanupWorker.on("error", (error) => {
  logger.error({ err: error }, "Demo cleanup worker error");
});

export async function closeDemoCleanupWorker(): Promise<void> {
  logger.info("Closing demo cleanup worker...");

  await demoCleanupWorker.close();

  logger.info("Demo cleanup worker closed.");
}
