import { createHmac } from "node:crypto";

import { Queue } from "bullmq";

import { redisConfig } from "../../config/redis.config.js";
import { EMAIL_JOB_NAMES } from "./email.jobs.js";
import type {
  PasswordResetEmailJob,
  VerificationEmailJob,
  WorkspaceInvitationEmailJob,
} from "./email.types.js";

import { QUEUE_NAMES } from "../queue.constants.js";

// Mirrors lib/auth.ts's signInAccountRateLimitKey: Redis keys (jobId becomes
// part of one) are visible through SCAN/KEYS, backups, and admin/monitoring
// tooling in a way that shouldn't hand out a live, directly-usable
// verification/password-reset token. Reads BETTER_AUTH_SECRET directly
// rather than importing it from lib/auth.ts, which already imports the two
// enqueue*() functions below that use this - importing back would be
// circular. By the time either function actually runs, auth.ts has always
// already imported successfully (it's the only caller), so this env var is
// already known-valid; validated again here anyway, matching how every
// other config module in this codebase (redis.config.ts, security.config.ts,
// email.config.ts) independently guards its own required env vars rather
// than assuming another module already did.
// Typed as a plain string (rather than string | undefined) so hmacToken
// below - a closure TS can't narrow into across the function boundary -
// doesn't need its own assertion; the guard immediately below still throws
// on a genuinely missing value. Mirrors lib/auth.ts's identical
// authHmacSecret pattern.
const jobIdHmacSecret: string = process.env.BETTER_AUTH_SECRET ?? "";

if (!jobIdHmacSecret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required.");
}

function hmacToken(token: string): string {
  return createHmac("sha256", jobIdHmacSecret).update(token).digest("hex");
}

// Producer-only connection: a separate config object (not a mutation of
// redisConfig, which email.worker.ts's Worker also reads) so this doesn't
// touch the worker's connection or its indefinite-reconnect behavior.
// enableOfflineQueue: false is what actually bounds enqueueEmailWithTimeout
// above (F-14) - without it, Promise.race's 2s timeout only bounds the
// *caller's wait*, while ioredis keeps the underlying .add() command
// buffered in its offline queue, retrying the connection forever; verified
// empirically (throwaway process, real Redis killed after a successful
// warmup add()) that with this flag a post-outage .add() rejects in ~1ms
// instead of hanging, so timed-out enqueues can no longer accumulate.
// (A from-scratch-unreachable Redis at process start is a different,
// pre-existing gap - BullMQ's own connection-readiness gate blocks before
// this flag is even consulted - but that's not the "accumulates under
// sustained traffic" backlog CodeRabbit flagged, which is specifically the
// already-connected-then-outage case this fixes.)
const emailQueueConnection = {
  ...redisConfig,
  enableOfflineQueue: false,
};

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: emailQueueConnection,
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
  // Deterministic jobId, keyed on invitationId + the specific expiresAt
  // THIS call set - not on invitationId/token alone. resendInvitation()
  // (invitation.service.ts) reuses the same invitationId and token on every
  // resend, but it always computes a fresh expiresAt
  // (new Date(Date.now() + 7 days)) and persists it via
  // prisma.workspaceInvitation.update() before this is ever called - so
  // every genuinely separate create/resend action gets its own jobId, while
  // two enqueue calls sharing the exact same already-computed invitation
  // object/expiresAt (e.g. a hypothetical retry of just this enqueue step)
  // correctly collapse into one job. This is what makes it safe against
  // BullMQ's removeOnFail retention below: a later resend's fresh expiresAt
  // is never blocked by an earlier, permanently-failed send's still-retained
  // jobId - unlike a plain invitationId/token key would be (verified against
  // addStandardJob-9.lua/handleDuplicatedJob.lua: re-adding an existing,
  // still-present jobId is a silent no-op, not a new attempt).
  const expiresAtMs = Date.parse(payload.expiresAt);

  await emailQueue.add(EMAIL_JOB_NAMES.WORKSPACE_INVITATION, payload, {
    ...(!Number.isNaN(expiresAtMs) && {
      jobId: `${EMAIL_JOB_NAMES.WORKSPACE_INVITATION}-${payload.invitationId}-${expiresAtMs}`,
    }),
  });
}

export async function enqueueVerificationEmail(
  payload: VerificationEmailJob,
): Promise<void> {
  // Deterministic jobId, safe here specifically because every send -
  // including a resend via POST /send-verification-email - mints a brand
  // new signed JWT (verified against the installed better-auth package's
  // api/routes/email-verification.mjs: createEmailVerificationToken signs a
  // fresh token on every call; nothing is looked up or reused). Two enqueue
  // calls sharing the same token are therefore always the SAME logical send
  // (e.g. an accidental duplicate call for that one send), never two
  // different logical sends - a genuine resend always carries a different
  // token and is never blocked by a prior job under this scheme, including
  // one that permanently failed and is still retained by removeOnFail
  // below.
  //
  // HMAC-SHA256 of the token, not the token itself, before it becomes part
  // of a Redis key - see hmacToken's comment above. Hyphen-joined, not
  // colon-joined: the installed bullmq (verified against
  // node_modules/bullmq/dist/cjs/classes/job.js's validateOptions) rejects
  // any custom jobId containing ':' unless it splits into exactly 3 parts -
  // a legacy compatibility rule for BullMQ's own repeatable-job id format,
  // not a general-purpose delimiter, and that file's own comment flags a
  // future version will reject ':' outright.
  const token = new URL(payload.url).searchParams.get("token");

  await emailQueue.add(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, payload, {
    ...(token && {
      jobId: `${EMAIL_JOB_NAMES.EMAIL_VERIFICATION}-${hmacToken(token)}`,
    }),
  });
}

export async function enqueuePasswordResetEmail(
  payload: PasswordResetEmailJob,
): Promise<void> {
  // Same reasoning as enqueueVerificationEmail's token extraction above.
  // Better Auth's sendResetPassword callback only ever provides `url`, not a
  // separate token field, and the token sits in the URL's last path segment
  // (`${baseURL}/reset-password/${verificationToken}?...`), not a query
  // param (verified against the installed better-auth package's
  // api/routes/password.mjs). requestPasswordReset() calls generateId(24)
  // and persists a brand-new verification row on every call
  // (createVerificationValue, never an update) - so, same as email
  // verification, a genuine resend always carries a different token and is
  // never blocked by a prior job.
  const token = new URL(payload.url).pathname.split("/").filter(Boolean).pop();

  await emailQueue.add(EMAIL_JOB_NAMES.PASSWORD_RESET, payload, {
    ...(token && {
      jobId: `${EMAIL_JOB_NAMES.PASSWORD_RESET}-${hmacToken(token)}`,
    }),
  });
}
