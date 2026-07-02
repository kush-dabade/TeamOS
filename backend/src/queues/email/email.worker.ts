import { Worker } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";
import { sendWorkspaceInvitation } from "../../modules/email/index.js";
import { QUEUE_NAMES } from "../queue.constants.js";
import { EMAIL_JOB_NAMES } from "./email.jobs.js";
import type { WorkspaceInvitationEmailJob } from "./email.types.js";

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
  console.log("Email worker is ready.");
});

emailWorker.on("completed", (job) => {
  console.log(`Completed email job: ${job.id} (${job.name})`);
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `Email job ${job?.id ?? "unknown"} (${job?.name ?? "unknown"}) failed:`,
    error,
  );
});

emailWorker.on("error", (error) => {
  console.error("Email worker error:", error);
});

export async function closeEmailWorker(): Promise<void> {
  console.log("Closing email worker...");

  await emailWorker.close();

  console.log("Email worker closed.");
}