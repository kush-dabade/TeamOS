import { Queue } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";

import { NOTIFICATION_JOB_NAMES } from "./notification.jobs.js";
import type { CreateNotificationJobData } from "./notification.types.js";

import { QUEUE_NAMES } from "../queue.constants.js";

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection: redisConfig,

  defaultJobOptions: {
    attempts: 5,

    backoff: {
      type: "exponential",
      delay: 1000,
    },

    removeOnComplete: true,
  },
});

export async function enqueueNotification(
  payload: CreateNotificationJobData,
): Promise<void> {
  await notificationQueue.add(
    NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION,
    payload,
  );
}
