import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import * as emailQueueModule from "../../src/queues/email/email.queue.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";

import { resetDatabase } from "../setup/reset-database.js";

/**
 * Commit 6: requireEmailVerification (backend/src/lib/auth.ts). Proves both
 * sides - a legitimate verified user can still sign in, and an unverified
 * account (the exploit this closes: signing up with an email you don't own)
 * cannot get an authenticated session.
 */
describe("email verification enforcement", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("does not create a session on sign-up - the address is unverified", async () => {
    const email = `unverified-${crypto.randomUUID()}@example.com`;

    const response = await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password: "password1234" })
      .expect(200);

    expect(response.body.token).toBeNull();
    expect(response.headers["set-cookie"]).toBeUndefined();

    const user = await prisma.user.findFirst({ where: { email } });

    expect(user?.emailVerified).toBe(false);
  });

  it("rejects sign-in for a correct password when the email is unverified", async () => {
    const email = `unverified-signin-${crypto.randomUUID()}@example.com`;
    const password = "password1234";

    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password })
      .expect(200);

    const response = await request(app).post("/api/auth/sign-in/email").send({ email, password });

    expect(response.status).toBe(403);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("allows sign-in once the email is verified, and the resulting session works", async () => {
    const email = `verified-${crypto.randomUUID()}@example.com`;
    const password = "password1234";

    const signUpResponse = await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password })
      .expect(200);

    await prisma.user.update({
      where: { id: signUpResponse.body.user.id },
      data: { emailVerified: true },
    });

    const signInResponse = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password })
      .expect(200);

    const setCookie = signInResponse.headers["set-cookie"] as unknown as string[] | undefined;

    expect(setCookie).toBeTruthy();
    expect(setCookie!.length).toBeGreaterThan(0);

    const cookie = setCookie!.map((entry) => entry.split(";")[0]).join("; ");

    await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(200);
  });

  it("enqueues a verification email job on sign-up", async () => {
    const email = `queue-check-${crypto.randomUUID()}@example.com`;

    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password: "password1234" })
      .expect(200);

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);

    const match = jobs.find(
      (job) => job.name === EMAIL_JOB_NAMES.EMAIL_VERIFICATION && job.data?.email === email,
    );

    expect(match).toBeTruthy();
  });

  it("verifies the account when the emailed token is used against the real endpoint", async () => {
    const email = `verify-endpoint-${crypto.randomUUID()}@example.com`;

    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password: "password1234" })
      .expect(200);

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);

    const job = jobs.find(
      (job) => job.name === EMAIL_JOB_NAMES.EMAIL_VERIFICATION && job.data?.email === email,
    );

    const verificationUrl = new URL(job!.data.url);
    const token = verificationUrl.searchParams.get("token");

    expect(verificationUrl.searchParams.get("callbackURL")).toBe(
      `${process.env.FRONTEND_URL}/verify-email`,
    );

    // Deliberately omitting callbackURL here: this proves the core
    // token -> emailVerified=true mechanism. The redirect-to-frontend
    // behavior (callbackURL) has no destination to redirect to until the
    // /verify-email frontend route exists (a later commit), and exercising
    // it here would depend on TRUSTED_ORIGINS matching FRONTEND_URL in the
    // test environment, which is a separate, already-flagged concern.
    const response = await request(app)
      .get("/api/auth/verify-email")
      .query({ token })
      .expect(200);

    expect(response.body.status).toBe(true);

    const user = await prisma.user.findFirst({ where: { email } });

    expect(user?.emailVerified).toBe(true);
  });

  /**
   * F-14: enqueueVerificationEmail() previously had no bound - if the
   * underlying Redis command never settled (empirically confirmed: a real
   * emailQueue.add() call against an unreachable Redis host never resolves
   * or rejects, since BullMQ forces maxRetriesPerRequest: null and ioredis's
   * default retryStrategy never gives up), lib/auth.ts's
   * sendVerificationEmail callback awaited it directly, and better-auth's
   * own runInBackgroundOrAwait awaits that callback with no
   * backgroundTasks.handler configured - so POST /sign-up/email itself
   * would hang forever, even though the account was already created.
   * Simulates that exact hang by replacing the real enqueueVerificationEmail
   * with one that never settles, then proves the real sign-up endpoint
   * still responds promptly and the account still gets created.
   */
  it("does not hang sign-up when the verification email can never be enqueued (F-14)", async () => {
    const enqueueSpy = vi
      .spyOn(emailQueueModule, "enqueueVerificationEmail")
      .mockImplementation(() => new Promise(() => {}));

    try {
      const email = `never-enqueued-${crypto.randomUUID()}@example.com`;
      const startedAt = Date.now();

      const response = await request(app)
        .post("/api/auth/sign-up/email")
        .send({ name: "Test User", email, password: "password1234" })
        .expect(200);

      // Comfortably above the 2s ENQUEUE_VERIFICATION_EMAIL_TIMEOUT_MS
      // (auth.ts) to absorb CI jitter, comfortably below what "actually
      // hung" would look like (the never-settling mock means an unfixed
      // version of this callback would blow past vitest's own 15s
      // testTimeout instead).
      expect(Date.now() - startedAt).toBeLessThan(4000);
      expect(response.body.token).toBeNull();

      const user = await prisma.user.findFirst({ where: { email } });

      expect(user).toBeTruthy();
      expect(user?.emailVerified).toBe(false);
    } finally {
      enqueueSpy.mockRestore();
    }
  });

  /**
   * F-14's fix must not regress Commit 4's deterministic jobId/HMAC work:
   * a normal sign-up (real Redis, no simulated failure) still produces a
   * job keyed by email-verification-<hmac(token)>, and the raw token still
   * never appears in the jobId.
   */
  it("still assigns the deterministic HMAC-keyed jobId through the timeout-wrapped enqueue path", async () => {
    const email = `deterministic-id-${crypto.randomUUID()}@example.com`;

    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password: "password1234" })
      .expect(200);

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const job = jobs.find(
      (job) => job.name === EMAIL_JOB_NAMES.EMAIL_VERIFICATION && job.data?.email === email,
    );

    expect(job).toBeDefined();

    const token = new URL(job!.data.url).searchParams.get("token")!;
    const expectedDigest = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
      .update(token)
      .digest("hex");

    expect(job!.id).toBe(`email-verification-${expectedDigest}`);
    expect(job!.id).not.toContain(token);
  });

  /**
   * A legitimate resend (POST /send-verification-email after sign-up) must
   * still enqueue a genuinely new job through the fixed path - Commit 4's
   * analysis (auth.ts's enqueueVerificationEmail comment) established that
   * this is safe because better-auth mints a fresh JWT per send.
   *
   * "Fresh" needs one correction discovered while writing this test:
   * better-auth's createEmailVerificationToken (node_modules/better-auth/
   * dist/crypto/jwt.mjs's signJWT) sets iat/exp at second granularity with
   * no nonce/jti, and HS256 signing is deterministic - two calls for the
   * same email within the same second produce a byte-identical JWT
   * (confirmed directly against the installed `jose` package). BullMQ
   * correctly collapses that into one job, which is the right outcome (the
   * two "different" sends would have carried the exact same link anyway) -
   * but it does mean this test needs a real >=1s gap between sign-up and
   * resend to observe two genuinely distinct tokens, or it would flake
   * depending on whether both calls happen to land in the same second.
   */
  it("still enqueues a fresh job on a legitimate resend a moment later", async () => {
    const email = `resend-${crypto.randomUUID()}@example.com`;

    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Test User", email, password: "password1234" })
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await request(app)
      .post("/api/auth/send-verification-email")
      .send({ email })
      .expect(200);

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const matching = jobs.filter(
      (job) => job.name === EMAIL_JOB_NAMES.EMAIL_VERIFICATION && job.data?.email === email,
    );

    expect(matching.length).toBeGreaterThanOrEqual(2);

    const distinctJobIds = new Set(matching.map((job) => job.id));

    expect(distinctJobIds.size).toBe(matching.length);
  });
});
