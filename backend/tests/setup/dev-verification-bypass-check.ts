/**
 * Standalone script, not a Vitest test file - same rationale as
 * secure-cookie-production-check.ts / hsts-production-check.ts:
 * config/security.config.ts's isProduction/isLocalDevelopment are
 * module-level consts frozen at first import, so a real child process is
 * the only reliable way to observe their effect across the NODE_ENV values
 * this feature actually branches on. Deliberately run under NODE_ENV=production
 * AND NODE_ENV=development (not just production) - unlike most of this
 * suite's other production-check scripts, isLocalDevelopment's "on" state
 * (development) is never exercised by this test process's own in-process
 * run, which always has NODE_ENV=test (see lib/logger.ts's comment).
 *
 * Signs up a real user, then prints a small JSON object to stdout recording
 * whether that user came back already verified
 * (databaseHooks.user.create.before, lib/auth.ts) and whether a real
 * verification-email job was enqueued for them
 * (emailVerification.sendVerificationEmail, same file) - the two things
 * Commit 3's development-only bypass changes, both of which must flip
 * together with NODE_ENV and never activate under production.
 */
import request from "supertest";

import { prisma } from "../../src/lib/prisma.js";
import app from "../../src/app.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";
import { startTestServer } from "./test-server.js";

async function main() {
  const server = await startTestServer();

  const email = `dev-bypass-check-${crypto.randomUUID()}@example.com`;

  const signUpResponse = await request(app).post("/api/auth/sign-up/email").send({
    name: "Dev Bypass Check",
    email,
    password: "password1234",
  });

  const userId = signUpResponse.body.user.id as string;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
  const verificationEmailEnqueued = jobs.some(
    (job) => job.name === EMAIL_JOB_NAMES.EMAIL_VERIFICATION && job.data?.email === email,
  );

  const result = JSON.stringify({
    emailVerified: user.emailVerified,
    verificationEmailEnqueued,
  });

  await new Promise<void>((resolve) => {
    process.stdout.write(result, () => resolve());
  });

  await server.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
