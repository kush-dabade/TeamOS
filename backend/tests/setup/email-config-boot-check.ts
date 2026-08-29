/**
 * Standalone script, not a Vitest test file - same rationale as
 * dev-verification-bypass-check.ts: modules/email/email.config.ts's
 * validation and modules/email/email.client.ts's `new Resend(...)`
 * construction both run at module-import time and are frozen at first
 * import, so a real child process - with EMAIL_FROM/RESEND_API_KEY
 * deliberately present or absent - is the only reliable way to observe
 * whether importing this module graph throws.
 *
 * Imports exactly the two modules queues/email/email.worker.ts pulls in at
 * the top of its own import chain (via modules/email/index.ts ->
 * email.service.ts -> email.client.ts/email.config.ts) - the precise
 * boundary where a missing RESEND_API_KEY previously crashed the worker
 * process at startup, before it ever touched Redis/BullMQ. Deliberately
 * does not import email.worker.ts itself: that would start a real BullMQ
 * Worker against the shared dev/test Redis instance, which is unnecessary
 * to reproduce this specific import-time crash and would risk consuming
 * jobs other suites/processes enqueue there.
 */
try {
  const { emailConfig } = await import("../../src/modules/email/email.config.js");
  const { resend } = await import("../../src/modules/email/email.client.js");

  process.stdout.write(
    JSON.stringify({
      imported: true,
      enabled: emailConfig.enabled,
      resendIsNull: resend === null,
    }),
  );
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      imported: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}
