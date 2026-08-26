import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Job, Worker } from "bullmq";

import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

// The first vi.mock in tests/ - deliberately scoped to the single narrowest
// external-I/O boundary in the email path: the Resend client object itself
// (email.client.ts), not email.service.ts (our own dispatch/template logic)
// and not email.worker.ts (the thing under test). vi.mock calls are hoisted
// above every import in this file, so this is applied before
// email.worker.ts's module graph ever reaches email.client.ts - verified by
// running this file and confirming zero real network calls are made and
// mockSend observes every dispatched call.
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("../../src/modules/email/email.client.js", () => ({
  resend: { emails: { send: mockSend } },
}));

import { emailQueue } from "../../src/queues/email/email.queue.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";
import type {
  PasswordResetEmailJob,
  VerificationEmailJob,
  WorkspaceInvitationEmailJob,
} from "../../src/queues/email/email.types.js";

/**
 * Waits for a specific job (by id) to settle, via the worker's own
 * completed/failed events - not by polling queue.getJob(), which would be
 * unreliable here: the email queue's defaultJobOptions set
 * removeOnComplete: true, so a completed job is deleted from Redis the
 * instant it finishes and getJob() would never see it "complete", only
 * disappear. Registers listeners before returning so callers can create
 * this promise and only then enqueue, the same before-trigger ordering as
 * tests/setup/socket-client.ts's waitForEvent.
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
 * F-19's deterministic-jobId tests (deterministic-job-ids.test.ts) and every
 * real signup/invitation/password-reset flow exercised elsewhere in this
 * suite enqueue real jobs onto this same shared emailQueue - and since no
 * test file starts a worker (tests/setup/test-server.ts explicitly does
 * not), none of those jobs are ever consumed. They accumulate in Redis
 * across the whole suite run (Redis, unlike Postgres, is never reset
 * between test files). emailWorker is a module-level singleton that starts
 * consuming the instant it's imported - if that backlog were still present
 * when it starts, it would begin draining unrelated real jobs interleaved
 * with this file's own, making `mockSend` call-count assertions unreliable
 * and potentially delaying this file's own jobs behind a long backlog.
 * obliterate() (which also pauses the queue) wipes that backlog; the worker
 * module is then imported dynamically - AFTER obliterate/resume, not via a
 * static top-level import - so it cannot possibly have fetched any backlog
 * job before the queue was already clean and resumed.
 */
async function importCleanEmailWorker(): Promise<Worker> {
  await emailQueue.obliterate({ force: true });
  await emailQueue.resume();

  const { emailWorker } = await import("../../src/queues/email/email.worker.js");
  await emailWorker.waitUntilReady();

  return emailWorker;
}

describe("email worker dispatch mapping", () => {
  let emailWorker: Worker;
  const jobIdsToClean: string[] = [];

  beforeAll(async () => {
    emailWorker = await importCleanEmailWorker();
  });

  afterEach(async () => {
    mockSend.mockClear();

    for (const jobId of jobIdsToClean.splice(0)) {
      await emailQueue.remove(jobId);
    }
  });

  afterAll(async () => {
    await emailWorker.close();
  });

  it("dispatches a workspace-invitation job to sendWorkspaceInvitation, reaching the mocked Resend boundary with the right recipient and content", async () => {
    mockSend.mockResolvedValue({ data: { id: "mock-email-id" }, error: null });

    const jobId = `test-workspace-invitation-${crypto.randomUUID()}`;
    jobIdsToClean.push(jobId);

    const payload: WorkspaceInvitationEmailJob = {
      invitationId: crypto.randomUUID(),
      email: "invitee@example.com",
      workspaceName: "Acme",
      role: WorkspaceRole.MEMBER,
      invitedByName: "Owner",
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const settled = waitForJobSettled(emailWorker, jobId);
    await emailQueue.add(EMAIL_JOB_NAMES.WORKSPACE_INVITATION, payload, { jobId });

    await expect(settled).resolves.toBe("completed");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: payload.email,
        subject: "You've been invited to join Acme",
      }),
    );
  });

  it("dispatches an email-verification job to sendVerificationEmail, reaching the mocked Resend boundary with the right recipient", async () => {
    mockSend.mockResolvedValue({ data: { id: "mock-email-id" }, error: null });

    const jobId = `test-email-verification-${crypto.randomUUID()}`;
    jobIdsToClean.push(jobId);

    const payload: VerificationEmailJob = {
      email: "verify-me@example.com",
      name: "Verify Me",
      url: "http://localhost:3000/verify-email?token=abc123&callbackURL=x",
    };

    const settled = waitForJobSettled(emailWorker, jobId);
    await emailQueue.add(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, payload, { jobId });

    await expect(settled).resolves.toBe("completed");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: payload.email,
        subject: "Verify your email address",
      }),
    );
  });

  it("dispatches a password-reset job to sendPasswordResetEmail, reaching the mocked Resend boundary with the right recipient", async () => {
    mockSend.mockResolvedValue({ data: { id: "mock-email-id" }, error: null });

    const jobId = `test-password-reset-${crypto.randomUUID()}`;
    jobIdsToClean.push(jobId);

    const payload: PasswordResetEmailJob = {
      email: "reset-me@example.com",
      name: "Reset Me",
      url: "http://localhost:3000/reset-password/xyz789?callbackURL=x",
    };

    const settled = waitForJobSettled(emailWorker, jobId);
    await emailQueue.add(EMAIL_JOB_NAMES.PASSWORD_RESET, payload, { jobId });

    await expect(settled).resolves.toBe("completed");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: payload.email,
        subject: "Reset your TeamOS password",
      }),
    );
  });

  it("fails an unknown job name without ever calling the email sender", async () => {
    const jobId = `test-unknown-email-job-${crypto.randomUUID()}`;
    jobIdsToClean.push(jobId);

    const settled = waitForJobSettled(emailWorker, jobId);
    // attempts: 1 overrides the queue's default (5, with exponential
    // backoff) - this job is expected to fail deterministically on its
    // first attempt, not after minutes of retries.
    await emailQueue.add("totally-unknown-job", { irrelevant: true }, { jobId, attempts: 1 });

    await expect(settled).resolves.toBe("failed");

    expect(mockSend).not.toHaveBeenCalled();
  });
});
