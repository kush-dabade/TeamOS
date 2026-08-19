import { Queue } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";
import { EMAIL_JOB_NAMES } from "./email.jobs.js";
import type {
  PasswordResetEmailJob,
  VerificationEmailJob,
  WorkspaceInvitationEmailJob,
} from "./email.types.js";

import { QUEUE_NAMES } from "../queue.constants.js";

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    // Unbounded otherwise (BullMQ keeps failed jobs forever by default) -
    // 7 days is enough to notice and debug a batch of failures (e.g. a
    // Resend outage); 1000 is a hard ceiling in case a sustained outage
    // produces a burst of failures within that window.
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 1000,
    },
  },
});

export async function enqueueWorkspaceInvitationEmail(
  payload: WorkspaceInvitationEmailJob,
): Promise<void> {
  await emailQueue.add(EMAIL_JOB_NAMES.WORKSPACE_INVITATION, payload);
}

export async function enqueueVerificationEmail(
  payload: VerificationEmailJob,
): Promise<void> {
  await emailQueue.add(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, payload);
}

export async function enqueuePasswordResetEmail(
  payload: PasswordResetEmailJob,
): Promise<void> {
  await emailQueue.add(EMAIL_JOB_NAMES.PASSWORD_RESET, payload);
}
