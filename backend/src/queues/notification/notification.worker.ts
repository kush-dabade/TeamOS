import { Worker } from "bullmq";

import { logger } from "../../lib/logger.js";
import { redisConfig } from "../../config/redis.config.js";
import { createNotification } from "../../modules/notification/notification.service.js";

import { QUEUE_NAMES } from "../queue.constants.js";

import { NOTIFICATION_JOB_NAMES } from "./notification.jobs.js";
import type { CreateNotificationJobData } from "./notification.types.js";

export const notificationWorker = new Worker(
  QUEUE_NAMES.NOTIFICATION,
  async (job) => {
    switch (job.name) {
      case NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION: {
        const payload = job.data as CreateNotificationJobData;

        return await createNotification({
          workspaceId: payload.workspaceId,

          recipientId: payload.recipientId,

          type: payload.type,

          title: payload.title,
          message: payload.message,

          ...(payload.metadata && {
            metadata: payload.metadata,
          }),
        });
      }

      default:
        throw new Error(`Unknown notification job: ${job.name}`);
    }
  },
  {
    connection: redisConfig,
  },
);

notificationWorker.on("ready", () => {
  logger.info("Notification worker is ready.");
});

notificationWorker.on("completed", (job) => {
  logger.child({ jobId: job.id, jobName: job.name }).info("Completed notification job");
});

notificationWorker.on("failed", (job, error) => {
  logger
    .child({ jobId: job?.id ?? "unknown", jobName: job?.name ?? "unknown" })
    .error({ err: error }, "Notification job failed");
});

notificationWorker.on("error", (error) => {
  logger.error({ err: error }, "Notification worker error");
});

export async function closeNotificationWorker(): Promise<void> {
  logger.info("Closing notification worker...");

  await notificationWorker.close();

  logger.info("Notification worker closed.");
}
