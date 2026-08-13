import { afterEach, describe, expect, it } from "vitest";
import { Worker } from "bullmq";

import { redisConfig } from "../../src/config/redis.config.js";
import { QUEUE_NAMES } from "../../src/queues/queue.constants.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { notificationQueue } from "../../src/queues/notification/notification.queue.js";

/**
 * Commit 8: failed BullMQ jobs previously had no removeOnFail cap and were
 * retained in Redis forever. Proves both that the configured policy is
 * actually wired into each queue, and that BullMQ genuinely enforces
 * removeOnFail (using a tiny per-job override so the test doesn't need to
 * wait 7 days / generate 1000 jobs to observe it firing).
 */
describe("failed job retention", () => {
  const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

  let worker: Worker | undefined;

  afterEach(async () => {
    await worker?.close();
    worker = undefined;
  });

  it("configures removeOnFail: { age: 7 days, count: 1000 } on the email queue", () => {
    expect(emailQueue.opts.defaultJobOptions?.removeOnFail).toEqual({
      age: SEVEN_DAYS_SECONDS,
      count: 1000,
    });
  });

  it("configures removeOnFail: { age: 7 days, count: 1000 } on the notification queue", () => {
    expect(notificationQueue.opts.defaultJobOptions?.removeOnFail).toEqual({
      age: SEVEN_DAYS_SECONDS,
      count: 1000,
    });
  });

  it("actually removes a failed job once it exceeds its removeOnFail threshold", async () => {
    const job = await emailQueue.add(
      "retention-test-job",
      { probe: true },
      // Per-job override (BullMQ resolves job-level removeOnFail over the
      // queue's defaultJobOptions) so this test observes real removal
      // without needing 7 days/1000 jobs - same native mechanism, tiny
      // threshold.
      { attempts: 1, removeOnFail: { count: 0 } },
    );

    worker = new Worker(
      QUEUE_NAMES.EMAIL,
      () => {
        throw new Error("intentional test failure");
      },
      { connection: redisConfig, concurrency: 1 },
    );

    // Polls for removal rather than awaiting the "failed" event directly -
    // what this test needs to prove is that removeOnFail actually deletes
    // the job, not exactly when the event fires.
    const deadline = Date.now() + 5000;
    let remaining = await emailQueue.getJob(job.id!);

    while (remaining && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      remaining = await emailQueue.getJob(job.id!);
    }

    expect(remaining).toBeUndefined();
  });
});
