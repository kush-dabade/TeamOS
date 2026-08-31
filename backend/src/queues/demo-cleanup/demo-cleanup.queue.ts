import { Queue } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";
import { QUEUE_NAMES } from "../queue.constants.js";

export const DEMO_CLEANUP_JOB_NAME = "cleanup-expired-demo-sessions";

const DEMO_CLEANUP_SCHEDULER_ID = "demo-cleanup-schedule";

// Every 15 minutes - frequent enough that an expired demo workspace
// disappears reasonably soon after its TTL (DEMO_SESSION_TTL_HOURS,
// modules/demo/demo.constants.ts, is measured in hours - this is a small
// fraction of that), without the cleanup query running so often it's doing
// meaningful work for nothing. Exact-to-the-minute expiration was never
// the goal - see demo.constants.ts's own TTL comment.
const DEMO_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

export const demoCleanupQueue = new Queue(QUEUE_NAMES.DEMO_CLEANUP, {
  connection: redisConfig,

  defaultJobOptions: {
    removeOnComplete: true,

    // Matches queues/email/email.queue.ts and
    // queues/notification/notification.queue.ts's identical policy -
    // unbounded otherwise, 7 days/100 is enough to notice and debug a
    // failing sweep without retaining failures forever. A lower count
    // ceiling than the other two queues' 1000: this queue only ever
    // produces one job per 15 minutes (~96/day), so 100 failed jobs
    // already represents roughly a full day of sustained failures.
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 100,
    },
  },
});

/**
 * Registers (or re-registers) the repeatable cleanup job via BullMQ's
 * current Job Scheduler API. `queue.add(name, data, { repeat: {...} })`
 * still works in the installed bullmq (5.79) but is being phased out in
 * favor of upsertJobScheduler (queue.d.ts marks the older
 * getRepeatableJobs-based APIs deprecated, removed in v6) - this uses the
 * current, non-deprecated mechanism directly rather than adopting
 * something already on its way out.
 *
 * Safe to call on every worker process boot (see worker.ts): upserting an
 * existing scheduler with the same id and interval is a no-op beyond
 * confirming the next run is still scheduled, not a duplicate registration
 * - BullMQ's own contract for this method.
 */
export async function registerDemoCleanupSchedule(): Promise<void> {
  await demoCleanupQueue.upsertJobScheduler(
    DEMO_CLEANUP_SCHEDULER_ID,
    { every: DEMO_CLEANUP_INTERVAL_MS },
    { name: DEMO_CLEANUP_JOB_NAME },
  );
}
