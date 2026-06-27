import { Worker } from "bullmq";

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

        await createNotification({
          workspaceId: payload.workspaceId,

          recipientId: payload.recipientId,

          type: payload.type,

          title: payload.title,
          message: payload.message,

          ...(payload.metadata && {
            metadata: payload.metadata,
          }),
        });

        break;
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
  console.log("Notification worker is ready.");
});

notificationWorker.on("completed", (job) => {
  console.log(`Completed notification job: ${job.id} (${job.name})`);
});

notificationWorker.on("failed", (job, error) => {
  console.error(
    `Notification job ${job?.id ?? "unknown"} (${job?.name ?? "unknown"}) failed:`,
    error,
  );
});

notificationWorker.on("error", (error) => {
  console.error("Notification worker error:", error);
});
