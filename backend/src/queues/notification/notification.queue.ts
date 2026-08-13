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

    // Unbounded otherwise (BullMQ keeps failed jobs forever by default) -
    // 7 days is enough to notice and debug a batch of failures; 1000 is a
    // hard ceiling in case a sustained failure burst hits within that
    // window. Matches queues/email/email.queue.ts's identical policy.
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 1000,
    },
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
