import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Job, Worker } from "bullmq";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { NotificationType } from "../../src/generated/prisma/enums.js";

import { resetDatabase } from "../setup/reset-database.js";
import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

import { notificationQueue } from "../../src/queues/notification/notification.queue.js";
import { NOTIFICATION_JOB_NAMES } from "../../src/queues/notification/notification.jobs.js";
import type { CreateNotificationJobData } from "../../src/queues/notification/notification.types.js";

/**
 * Same rationale as email-worker-dispatch.test.ts's identical helper: the
 * notification queue also sets removeOnComplete: true, so a completed job
 * vanishes from Redis the instant it finishes - polling queue.getJob()
 * would never observe "completed", only "gone". Listens on the worker's own
 * completed/failed events instead, filtered to this specific job id.
 */
function waitForJobSettled(
  worker: Worker,
  jobId: string,
  timeoutMs = 10000,
): Promise<"completed" | "failed"> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for job ${jobId} to settle`));
    }, timeoutMs);

    function onCompleted(job: Job) {
      if (job.id === jobId) {
        cleanup();
        resolve("completed");
      }
    }

    function onFailed(job: Job | undefined) {
      if (job?.id === jobId) {
        cleanup();
        resolve("failed");
      }
    }

    function cleanup() {
      clearTimeout(timer);
      worker.off("completed", onCompleted);
      worker.off("failed", onFailed);
    }

    worker.on("completed", onCompleted);
    worker.on("failed", onFailed);
  });
}

/**
 * Same backlog hazard as email-worker-dispatch.test.ts's identical helper,
 * with a sharper failure mode here: every real comment/task/invitation flow
 * exercised elsewhere in this suite enqueues real create-notification jobs
 * (comments.service.ts, task reassignment, etc.) that are never consumed
 * (no test starts a worker), so they accumulate in Redis across the whole
 * run. Worse, those backlog jobs reference workspaceId/recipientId values
 * from workspaces/users that resetDatabase() has since truncated in every
 * later test file - notificationWorker draining them for real would hit
 * real FK-constraint failures against Postgres and could stall this file's
 * own job behind a long retry backlog (concurrency is unspecified on this
 * worker, i.e. BullMQ's default of 1 - strictly one job at a time).
 * obliterate()+resume() before the worker module is ever imported
 * eliminates the backlog by construction, not by timing luck.
 */
async function importCleanNotificationWorker(): Promise<Worker> {
  await notificationQueue.obliterate({ force: true });
  await notificationQueue.resume();

  const { notificationWorker } = await import(
    "../../src/queues/notification/notification.worker.js"
  );
  await notificationWorker.waitUntilReady();

  return notificationWorker;
}

describe("notification worker dispatch mapping", () => {
  let notificationWorker: Worker;
  const jobIdsToClean: string[] = [];

  beforeAll(async () => {
    notificationWorker = await importCleanNotificationWorker();
  });

  afterEach(async () => {
    for (const jobId of jobIdsToClean.splice(0)) {
      await notificationQueue.remove(jobId);
    }

    await resetDatabase();
  });

  afterAll(async () => {
    await notificationWorker.close();
  });

  it("dispatches a create-notification job to createNotification, persisting the expected Notification row", async () => {
    const user = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(user.userId);

    const jobId = `test-create-notification-${crypto.randomUUID()}`;
    jobIdsToClean.push(jobId);

    const payload: CreateNotificationJobData = {
      workspaceId: workspace.id,
      recipientId: user.userId,
      type: NotificationType.TASK_ASSIGNED,
      title: "Dispatch test notification",
      message: "Verifying the worker's dispatch mapping.",
      eventId: crypto.randomUUID(),
    };

    const settled = waitForJobSettled(notificationWorker, jobId);
    await notificationQueue.add(NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION, payload, {
      jobId,
    });

    await expect(settled).resolves.toBe("completed");

    const persisted = await prisma.notification.findFirst({
      where: { recipientId: user.userId, title: "Dispatch test notification" },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.workspaceId).toBe(workspace.id);
    expect(persisted?.type).toBe(NotificationType.TASK_ASSIGNED);
    expect(persisted?.message).toBe("Verifying the worker's dispatch mapping.");
  });

  it("fails an unknown job name without creating any Notification row", async () => {
    const jobId = `test-unknown-notification-job-${crypto.randomUUID()}`;
    jobIdsToClean.push(jobId);

    const settled = waitForJobSettled(notificationWorker, jobId);
    // attempts: 1 overrides the queue's default (5, with exponential
    // backoff) - deterministic failure on the first attempt, not after
    // minutes of retries.
    await notificationQueue.add(
      "totally-unknown-job",
      { irrelevant: true },
      { jobId, attempts: 1 },
    );

    await expect(settled).resolves.toBe("failed");

    const countAfter = await prisma.notification.count();
    expect(countAfter).toBe(0);
  });
});
