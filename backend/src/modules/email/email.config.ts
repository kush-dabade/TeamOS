import { isLocalDevelopment } from "../../config/security.config.js";

const frontendUrl = process.env.FRONTEND_URL;
const emailFrom = process.env.EMAIL_FROM;
const resendApiKey = process.env.RESEND_API_KEY;

if (!frontendUrl) {
  throw new Error("FRONTEND_URL environment variable is required.");
}

// EMAIL_FROM/RESEND_API_KEY stay required everywhere except local
// development - gated on isLocalDevelopment (not `!isProduction`), same
// boundary as lib/auth.ts's development-only email-verification bypass and
// prisma/seed.ts's seed guard: NODE_ENV=test must keep failing fast here too,
// since backend/.env.test.example already ships real (dummy) values for
// both and env-example-parity.test.ts depends on that contract holding, and
// a misconfigured production deployment must never silently start with
// email sending disabled. A missing value locally must not crash the worker
// process though (see queues/email/email.worker.ts's import chain, which
// pulls this module in at startup) - only disable actual sending, via
// `enabled` below.
const emailSendingConfigured = Boolean(emailFrom && resendApiKey);

if (!emailSendingConfigured && !isLocalDevelopment) {
  const missing = [!emailFrom && "EMAIL_FROM", !resendApiKey && "RESEND_API_KEY"]
    .filter((name): name is string => Boolean(name))
    .join(" and ");

  throw new Error(`${missing} environment variable(s) required.`);
}

export const emailConfig = {
  frontendUrl,
  from: emailFrom ?? "",
  resendApiKey: resendApiKey ?? "",
  // False only in local development with no Resend credentials configured -
  // see email.client.ts and email.service.ts, which use this to skip
  // constructing a real Resend client / actually sending, instead of
  // crashing or making a network call doomed to fail.
  enabled: emailSendingConfigured,
};