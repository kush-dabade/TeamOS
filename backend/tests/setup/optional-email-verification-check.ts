/**
 * Standalone script, not a Vitest test file - same rationale as
 * dev-verification-bypass-check.ts: REQUIRE_EMAIL_VERIFICATION and NODE_ENV
 * are both read once at module load (config/security.config.ts), so each
 * combination the calling test covers needs a genuinely separate process.
 *
 * Drives one new account through the real HTTP endpoints - sign-up, a
 * duplicate sign-up, sign-in, an authenticated request with each session,
 * a password-reset request and a workspace invitation - and prints a JSON
 * summary of what happened, including which email jobs were queued for
 * that account. The calling test decides what each mode should produce.
 */
import request from "supertest";
import type { Response } from "supertest";

import { prisma } from "../../src/lib/prisma.js";
import app from "../../src/app.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";
import { startTestServer } from "./test-server.js";

function sessionCookie(response: Response): string | null {
  // Node exposes repeated headers like set-cookie as a real string[]; see
  // tests/setup/fixtures.ts's signUpTestUser for the same cast.
  const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;

  if (!setCookie || setCookie.length === 0) {
    return null;
  }

  return setCookie.map((entry) => entry.split(";")[0]).join("; ");
}

async function main() {
  const server = await startTestServer();

  const email = `optional-verification-${crypto.randomUUID()}@example.com`;
  const inviteeEmail = `optional-verification-invitee-${crypto.randomUUID()}@example.com`;
  const password = "Password1234";

  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: "Optional Verification Check", email, password });

  const signUpCookie = sessionCookie(signUp);

  const signUpSessionStatus = signUpCookie
    ? (await request(app).get("/api/v1/workspaces").set("Cookie", signUpCookie)).status
    : null;

  const duplicateSignUp = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: "Optional Verification Check", email, password });

  const signIn = await request(app).post("/api/auth/sign-in/email").send({ email, password });
  const signInCookie = sessionCookie(signIn);

  let signInSessionStatus: number | null = null;
  let invitationStatus: number | null = null;

  if (signInCookie) {
    signInSessionStatus = (
      await request(app).get("/api/v1/workspaces").set("Cookie", signInCookie)
    ).status;

    const workspace = await request(app)
      .post("/api/v1/workspaces")
      .set("Cookie", signInCookie)
      .send({ name: "Optional Verification Workspace" });

    invitationStatus = (
      await request(app)
        .post(`/api/v1/workspaces/${workspace.body.data.id as string}/invitations`)
        .set("Cookie", signInCookie)
        .send({ email: inviteeEmail, role: "MEMBER" })
    ).status;
  }

  const passwordResetStatus = (
    await request(app).post("/api/auth/request-password-reset").send({ email })
  ).status;

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
  const queued = (name: string, recipient: string) =>
    jobs.filter((job) => job.name === name && job.data?.email === recipient).length;

  const result = JSON.stringify({
    signUpStatus: signUp.status,
    signUpReturnedToken: signUp.body.token !== null && signUp.body.token !== undefined,
    signUpSetSessionCookie: signUpCookie !== null,
    signUpSessionStatus,
    duplicateSignUpStatus: duplicateSignUp.status,
    duplicateSignUpCode: duplicateSignUp.body.code ?? null,
    signInStatus: signIn.status,
    signInCode: signIn.body.code ?? null,
    signInSessionStatus,
    invitationStatus,
    passwordResetStatus,
    emailVerified: user.emailVerified,
    verificationEmailJobs: queued(EMAIL_JOB_NAMES.EMAIL_VERIFICATION, email),
    passwordResetEmailJobs: queued(EMAIL_JOB_NAMES.PASSWORD_RESET, email),
    invitationEmailJobs: queued(EMAIL_JOB_NAMES.WORKSPACE_INVITATION, inviteeEmail),
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
