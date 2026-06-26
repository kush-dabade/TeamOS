import { Queue } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";
import { EMAIL_JOB_NAMES } from "./email.jobs.js";
import type { WorkspaceInvitationEmailJob } from "./email.types.js";

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
  },
});

export async function enqueueWorkspaceInvitationEmail(
  payload: WorkspaceInvitationEmailJob,
): Promise<void> {
  await emailQueue.add(EMAIL_JOB_NAMES.WORKSPACE_INVITATION, payload);
}
