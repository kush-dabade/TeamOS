import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  emailQueue,
  enqueuePasswordResetEmail,
  enqueueVerificationEmail,
  enqueueWorkspaceInvitationEmail,
} from "../../src/queues/email/email.queue.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";
import {
  enqueueNotification,
  notificationQueue,
} from "../../src/queues/notification/notification.queue.js";
import { NOTIFICATION_JOB_NAMES } from "../../src/queues/notification/notification.jobs.js";
import { NotificationType } from "../../src/generated/prisma/enums.js";

// Independently recomputes the same digest email.queue.ts's private
// hmacToken() produces, rather than importing it - this way the test
// verifies the actual algorithm's output against a real HMAC computed here,
// not just "whatever the internal function happens to return" (which would
// pass even if hmacToken's implementation silently regressed to a no-op).
function expectedTokenDigest(token: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET must be set for this test.");
  }

  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * F-19: email/password-reset/notification jobs previously got BullMQ's
 * auto-generated jobId, so a duplicate enqueue for the exact same logical
 * event created a second, independent job rather than deduplicating.
 * Exercises the real queues and the real exported enqueue*() functions -
 * not standalone id-generation helpers - so this proves actual BullMQ dedup
 * behavior (see email.queue.ts/notification.queue.ts's collision-analysis
 * comments for the reasoning behind each job type's chosen identity).
 */
describe("F-19: deterministic email job ids", () => {
  const jobIdsToClean: string[] = [];

  afterEach(async () => {
    for (const jobId of jobIdsToClean.splice(0)) {
      await emailQueue.remove(jobId);
    }
  });

  it("keys an email-verification job by an HMAC digest of the token, not the raw token", async () => {
    const token = `verify-token-${crypto.randomUUID()}`;
    const expectedJobId = `email-verification-${expectedTokenDigest(token)}`;
    jobIdsToClean.push(expectedJobId);

    await enqueueVerificationEmail({
      email: "a@example.com",
      name: "A",
      url: `http://localhost:3000/verify-email?token=${token}&callbackURL=x`,
    });

    const job = await emailQueue.getJob(expectedJobId);

    expect(job).toBeDefined();
    expect(job!.name).toBe(EMAIL_JOB_NAMES.EMAIL_VERIFICATION);
    expect(job!.data.email).toBe("a@example.com");
    // The raw token must not appear anywhere in the jobId itself.
    expect(job!.id).not.toContain(token);
  });

  it("deduplicates two enqueue calls that share the same verification token", async () => {
    const token = `verify-token-${crypto.randomUUID()}`;
    const expectedJobId = `email-verification-${expectedTokenDigest(token)}`;
    jobIdsToClean.push(expectedJobId);

    const url = `http://localhost:3000/verify-email?token=${token}&callbackURL=x`;

    await enqueueVerificationEmail({ email: "first@example.com", name: "First", url });
    // Second call carries different data (name/email) specifically so this
    // test can prove BullMQ's real "duplicated jobId" behavior - it keeps
    // the FIRST job's data untouched rather than creating a second job or
    // overwriting the first (see addStandardJob-9.lua/handleDuplicatedJob.lua).
    await enqueueVerificationEmail({ email: "second@example.com", name: "Second", url });

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const matching = jobs.filter((job) => job.id === expectedJobId);

    expect(matching).toHaveLength(1);
    expect(matching[0]!.data.email).toBe("first@example.com");
  });

  it("does not collide between two different verification tokens", async () => {
    const tokenA = `verify-token-${crypto.randomUUID()}`;
    const tokenB = `verify-token-${crypto.randomUUID()}`;
    jobIdsToClean.push(
      `email-verification-${expectedTokenDigest(tokenA)}`,
      `email-verification-${expectedTokenDigest(tokenB)}`,
    );

    await enqueueVerificationEmail({
      email: "a@example.com",
      name: "A",
      url: `http://localhost:3000/verify-email?token=${tokenA}&callbackURL=x`,
    });
    await enqueueVerificationEmail({
      email: "b@example.com",
      name: "B",
      url: `http://localhost:3000/verify-email?token=${tokenB}&callbackURL=x`,
    });

    const jobA = await emailQueue.getJob(`email-verification-${expectedTokenDigest(tokenA)}`);
    const jobB = await emailQueue.getJob(`email-verification-${expectedTokenDigest(tokenB)}`);

    expect(jobA?.data.email).toBe("a@example.com");
    expect(jobB?.data.email).toBe("b@example.com");
  });

  it("keys a password-reset job by an HMAC digest of the token, not the raw token", async () => {
    const token = `reset-token-${crypto.randomUUID()}`;
    const expectedJobId = `password-reset-${expectedTokenDigest(token)}`;
    jobIdsToClean.push(expectedJobId);

    await enqueuePasswordResetEmail({
      email: "a@example.com",
      name: "A",
      url: `http://localhost:3000/reset-password/${token}?callbackURL=x`,
    });

    const job = await emailQueue.getJob(expectedJobId);

    expect(job).toBeDefined();
    expect(job!.name).toBe(EMAIL_JOB_NAMES.PASSWORD_RESET);
    expect(job!.data.email).toBe("a@example.com");
    expect(job!.id).not.toContain(token);
  });

  it("deduplicates two enqueue calls that share the same password-reset token", async () => {
    const token = `reset-token-${crypto.randomUUID()}`;
    const expectedJobId = `password-reset-${expectedTokenDigest(token)}`;
    jobIdsToClean.push(expectedJobId);

    const url = `http://localhost:3000/reset-password/${token}?callbackURL=x`;

    await enqueuePasswordResetEmail({ email: "first@example.com", name: "First", url });
    await enqueuePasswordResetEmail({ email: "second@example.com", name: "Second", url });

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const matching = jobs.filter((job) => job.id === expectedJobId);

    expect(matching).toHaveLength(1);
    expect(matching[0]!.data.email).toBe("first@example.com");
  });

  it("does not collide between two different password-reset tokens", async () => {
    const tokenA = `reset-token-${crypto.randomUUID()}`;
    const tokenB = `reset-token-${crypto.randomUUID()}`;
    jobIdsToClean.push(
      `password-reset-${expectedTokenDigest(tokenA)}`,
      `password-reset-${expectedTokenDigest(tokenB)}`,
    );

    await enqueuePasswordResetEmail({
      email: "a@example.com",
      name: "A",
      url: `http://localhost:3000/reset-password/${tokenA}?callbackURL=x`,
    });
    await enqueuePasswordResetEmail({
      email: "b@example.com",
      name: "B",
      url: `http://localhost:3000/reset-password/${tokenB}?callbackURL=x`,
    });

    const jobA = await emailQueue.getJob(`password-reset-${expectedTokenDigest(tokenA)}`);
    const jobB = await emailQueue.getJob(`password-reset-${expectedTokenDigest(tokenB)}`);

    expect(jobA?.data.email).toBe("a@example.com");
    expect(jobB?.data.email).toBe("b@example.com");
  });

  it("does not collide across email-verification and password-reset job-name namespaces, even with the same token", async () => {
    const sharedToken = `shared-token-${crypto.randomUUID()}`;
    const digest = expectedTokenDigest(sharedToken);
    jobIdsToClean.push(`email-verification-${digest}`, `password-reset-${digest}`);

    await enqueueVerificationEmail({
      email: "verify@example.com",
      name: "V",
      url: `http://localhost:3000/verify-email?token=${sharedToken}&callbackURL=x`,
    });
    await enqueuePasswordResetEmail({
      email: "reset@example.com",
      name: "R",
      url: `http://localhost:3000/reset-password/${sharedToken}?callbackURL=x`,
    });

    const verificationJob = await emailQueue.getJob(`email-verification-${digest}`);
    const resetJob = await emailQueue.getJob(`password-reset-${digest}`);

    expect(verificationJob?.data.email).toBe("verify@example.com");
    expect(resetJob?.data.email).toBe("reset@example.com");
  });

  function invitationPayload(overrides: { invitationId: string; expiresAt: string }) {
    return {
      email: "invitee@example.com",
      workspaceName: "Acme",
      role: "MEMBER" as const,
      invitedByName: "Owner",
      token: `invite-token-${crypto.randomUUID()}`,
      ...overrides,
    };
  }

  it("deduplicates two enqueue calls for the same invitationId and expiresAt", async () => {
    const invitationId = `invitation-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const expectedJobId = `workspace-invitation-${invitationId}-${Date.parse(expiresAt)}`;
    jobIdsToClean.push(expectedJobId);

    await enqueueWorkspaceInvitationEmail(invitationPayload({ invitationId, expiresAt }));
    await enqueueWorkspaceInvitationEmail(invitationPayload({ invitationId, expiresAt }));

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const matching = jobs.filter((job) => job.id === expectedJobId);

    expect(matching).toHaveLength(1);
  });

  /**
   * The actual point of keying on invitationId+expiresAt rather than
   * invitationId+token alone: resendInvitation() (invitation.service.ts)
   * reuses the same invitationId and token on every resend, but always
   * computes a fresh expiresAt. This proves a "resend" (same invitationId,
   * new expiresAt - exactly what resendInvitation() produces) is never
   * silently deduplicated against a prior send, including one that's still
   * sitting in Redis under removeOnFail retention.
   */
  it("does not deduplicate a resend (same invitationId, different expiresAt)", async () => {
    const invitationId = `invitation-${crypto.randomUUID()}`;
    const originalExpiresAt = new Date(Date.now() + 60_000).toISOString();
    const resendExpiresAt = new Date(Date.now() + 120_000).toISOString();
    const originalJobId = `workspace-invitation-${invitationId}-${Date.parse(originalExpiresAt)}`;
    const resendJobId = `workspace-invitation-${invitationId}-${Date.parse(resendExpiresAt)}`;
    jobIdsToClean.push(originalJobId, resendJobId);

    await enqueueWorkspaceInvitationEmail(
      invitationPayload({ invitationId, expiresAt: originalExpiresAt }),
    );
    await enqueueWorkspaceInvitationEmail(
      invitationPayload({ invitationId, expiresAt: resendExpiresAt }),
    );

    const originalJob = await emailQueue.getJob(originalJobId);
    const resendJob = await emailQueue.getJob(resendJobId);

    expect(originalJob).toBeDefined();
    expect(resendJob).toBeDefined();
    expect(originalJob!.id).not.toBe(resendJob!.id);
  });

  it("does not collide between two different invitationIds sharing the same expiresAt", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const invitationIdA = `invitation-${crypto.randomUUID()}`;
    const invitationIdB = `invitation-${crypto.randomUUID()}`;
    jobIdsToClean.push(
      `workspace-invitation-${invitationIdA}-${Date.parse(expiresAt)}`,
      `workspace-invitation-${invitationIdB}-${Date.parse(expiresAt)}`,
    );

    await enqueueWorkspaceInvitationEmail(
      invitationPayload({ invitationId: invitationIdA, expiresAt }),
    );
    await enqueueWorkspaceInvitationEmail(
      invitationPayload({ invitationId: invitationIdB, expiresAt }),
    );

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const matching = jobs.filter((job) => job.name === EMAIL_JOB_NAMES.WORKSPACE_INVITATION);

    expect(matching.some((job) => job.data.invitationId === invitationIdA)).toBe(true);
    expect(matching.some((job) => job.data.invitationId === invitationIdB)).toBe(true);
  });

  it("leaves the email queue's retry/removeOnFail policy unchanged", () => {
    expect(emailQueue.opts.defaultJobOptions?.attempts).toBe(5);
    expect(emailQueue.opts.defaultJobOptions?.backoff).toEqual({
      type: "exponential",
      delay: 1000,
    });
    expect(emailQueue.opts.defaultJobOptions?.removeOnComplete).toBe(true);
    expect(emailQueue.opts.defaultJobOptions?.removeOnFail).toEqual({
      age: 604800,
      count: 1000,
    });
  });
});

describe("F-19: deterministic notification job ids", () => {
  const jobIdsToClean: string[] = [];

  afterEach(async () => {
    for (const jobId of jobIdsToClean.splice(0)) {
      await notificationQueue.remove(jobId);
    }
  });

  function notificationPayload(overrides: { recipientId: string; eventId: string }) {
    return {
      workspaceId: `workspace-${crypto.randomUUID()}`,
      type: NotificationType.TASK_ASSIGNED,
      title: "Task Assigned",
      message: "You were assigned a task.",
      ...overrides,
    };
  }

  it("keys a notification job by recipientId + the caller-supplied eventId", async () => {
    const recipientId = `user-${crypto.randomUUID()}`;
    const eventId = `task-${crypto.randomUUID()}`;
    const expectedJobId = `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientId}-${eventId}`;
    jobIdsToClean.push(expectedJobId);

    await enqueueNotification(notificationPayload({ recipientId, eventId }));

    const job = await notificationQueue.getJob(expectedJobId);

    expect(job).toBeDefined();
    expect(job!.data.recipientId).toBe(recipientId);
  });

  it("deduplicates two enqueue calls for the same recipientId + eventId (e.g. a one-time entity id, like a freshly-created comment)", async () => {
    const recipientId = `user-${crypto.randomUUID()}`;
    const eventId = `comment-${crypto.randomUUID()}`;
    const expectedJobId = `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientId}-${eventId}`;
    jobIdsToClean.push(expectedJobId);

    await enqueueNotification(notificationPayload({ recipientId, eventId }));
    await enqueueNotification(notificationPayload({ recipientId, eventId }));

    const jobs = await notificationQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const matching = jobs.filter((job) => job.id === expectedJobId);

    expect(matching).toHaveLength(1);
  });

  /**
   * Proves the specific case this design was built for: an entity that can
   * legitimately generate the same kind of event again later (e.g. a task
   * reassigned, unassigned, then reassigned back to the same person -
   * task.service.ts's reassignment call site builds eventId as
   * `${taskId}-${updatedAt.getTime()}`). Two "events" for the same
   * recipient+taskId but a different version marker must NOT collide -
   * otherwise a second legitimate assignment notification could be silently
   * dropped while the first one's failed job is still retained.
   */
  it("does not deduplicate two different versions of the same recurring entity (e.g. a task reassigned twice)", async () => {
    const recipientId = `user-${crypto.randomUUID()}`;
    const taskId = `task-${crypto.randomUUID()}`;
    const firstEventId = `${taskId}-1000`;
    const secondEventId = `${taskId}-2000`;
    jobIdsToClean.push(
      `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientId}-${firstEventId}`,
      `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientId}-${secondEventId}`,
    );

    await enqueueNotification(notificationPayload({ recipientId, eventId: firstEventId }));
    await enqueueNotification(notificationPayload({ recipientId, eventId: secondEventId }));

    const jobs = await notificationQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const matching = jobs.filter((job) => job.data.recipientId === recipientId);

    expect(matching).toHaveLength(2);
  });

  it("does not collide between two different recipients sharing the same eventId", async () => {
    const eventId = `task-${crypto.randomUUID()}`;
    const recipientA = `user-${crypto.randomUUID()}`;
    const recipientB = `user-${crypto.randomUUID()}`;
    jobIdsToClean.push(
      `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientA}-${eventId}`,
      `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientB}-${eventId}`,
    );

    await enqueueNotification(notificationPayload({ recipientId: recipientA, eventId }));
    await enqueueNotification(notificationPayload({ recipientId: recipientB, eventId }));

    const jobA = await notificationQueue.getJob(
      `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientA}-${eventId}`,
    );
    const jobB = await notificationQueue.getJob(
      `${NOTIFICATION_JOB_NAMES.CREATE_NOTIFICATION}-${recipientB}-${eventId}`,
    );

    expect(jobA).toBeDefined();
    expect(jobB).toBeDefined();
  });

  it("leaves the notification queue's retry/removeOnFail policy unchanged", () => {
    expect(notificationQueue.opts.defaultJobOptions?.attempts).toBe(5);
    expect(notificationQueue.opts.defaultJobOptions?.backoff).toEqual({
      type: "exponential",
      delay: 1000,
    });
    expect(notificationQueue.opts.defaultJobOptions?.removeOnComplete).toBe(true);
    expect(notificationQueue.opts.defaultJobOptions?.removeOnFail).toEqual({
      age: 604800,
      count: 1000,
    });
  });
});
