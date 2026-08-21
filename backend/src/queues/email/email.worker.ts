import { Worker } from "bullmq";

import { logger } from "../../lib/logger.js";
import { redisConfig } from "../../config/redis.config.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWorkspaceInvitation,
} from "../../modules/email/index.js";
import { QUEUE_NAMES } from "../queue.constants.js";
import { EMAIL_JOB_NAMES } from "./email.jobs.js";
import type {
  PasswordResetEmailJob,
  VerificationEmailJob,
  WorkspaceInvitationEmailJob,
} from "./email.types.js";

export const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job) => {
    switch (job.name) {
      case EMAIL_JOB_NAMES.WORKSPACE_INVITATION: {
        const payload = job.data as WorkspaceInvitationEmailJob;

        await sendWorkspaceInvitation({
          recipientEmail: payload.email,
          workspaceName: payload.workspaceName,
          invitedByName: payload.invitedByName,
          role: payload.role,
          invitationToken: payload.token,
          expiresAt: new Date(payload.expiresAt),
        });

        break;
      }

      case EMAIL_JOB_NAMES.EMAIL_VERIFICATION: {
        const payload = job.data as VerificationEmailJob;

        await sendVerificationEmail({
          recipientEmail: payload.email,
          recipientName: payload.name,
          verificationUrl: payload.url,
        });

        break;
      }

      case EMAIL_JOB_NAMES.PASSWORD_RESET: {
        const payload = job.data as PasswordResetEmailJob;

        await sendPasswordResetEmail({
          recipientEmail: payload.email,
          recipientName: payload.name,
          resetUrl: payload.url,
        });

        break;
      }

      default:
        throw new Error(`Unknown email job: ${job.name}`);
    }
  },
  {
    connection: redisConfig,
    concurrency: 1,
  },
);

emailWorker.on("ready", () => {
  logger.info("Email worker is ready.");
});

emailWorker.on("completed", (job) => {
  logger.child({ jobId: job.id, jobName: job.name }).info("Completed email job");
});

emailWorker.on("failed", (job, error) => {
  logger
    .child({ jobId: job?.id ?? "unknown", jobName: job?.name ?? "unknown" })
    .error({ err: error }, "Email job failed");
});

emailWorker.on("error", (error) => {
  logger.error({ err: error }, "Email worker error");
});

export async function closeEmailWorker(): Promise<void> {
  logger.info("Closing email worker...");

  await emailWorker.close();

  logger.info("Email worker closed.");
}