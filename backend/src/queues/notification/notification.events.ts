import { QueueEvents } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";
import type { NotificationResponse } from "../../modules/notification/notification.types.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";
import { emitToUser } from "../../realtime/realtime.emitter.js";

import { QUEUE_NAMES } from "../queue.constants.js";

let notificationQueueEvents: QueueEvents | null = null;

export function initializeNotificationQueueEvents(): QueueEvents {
  const queueEvents = new QueueEvents(QUEUE_NAMES.NOTIFICATION, {
    connection: redisConfig,
  });

  queueEvents.on("completed", ({ returnvalue }) => {
    // The notification queue currently has a single job type
    // (NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION), so every completed job's
    // return value is a NotificationResponse - see notification.worker.ts.
    // The worker process never initializes Socket.IO, so this listener -
    // running in the API process, which does - is what actually performs
    // the realtime emit.
    //
    // Despite BullMQ's type declarations claiming `returnvalue` is a raw
    // JSON string, QueueEvents already JSON.parses it internally before
    // emitting "completed" (see queue-events.js's consumeEvents) - it
    // arrives here as an already-parsed object, not a string.
    try {
      const notification = returnvalue as unknown as NotificationResponse;

      emitToUser(
        notification.recipientId,
        REALTIME_EVENTS.NOTIFICATION_CREATED,
        {
          notification,
        },
      );
    } catch (error) {
      console.error(
        "Failed to emit realtime event for completed notification job:",
        error,
      );
    }
  });

  queueEvents.on("error", (error) => {
    console.error("Notification queue events error:", error);
  });

  notificationQueueEvents = queueEvents;

  return queueEvents;
}

export async function closeNotificationQueueEvents(): Promise<void> {
  if (!notificationQueueEvents) {
    return;
  }

  await notificationQueueEvents.close();

  notificationQueueEvents = null;
}
