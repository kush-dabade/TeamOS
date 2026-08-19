import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { emailQueue } from "../../src/queues/email/email.queue.js";
import { EMAIL_JOB_NAMES } from "../../src/queues/email/email.jobs.js";

import { resetDatabase } from "../setup/reset-database.js";
import { signUpTestUser } from "../setup/fixtures.js";

/**
 * Commit 5 (backend/src/lib/auth.ts's new sendResetPassword/
 * revokeSessionsOnPasswordReset config). Uses the real Better Auth
 * POST /request-password-reset and POST /reset-password endpoints
 * throughout - no mocking of Better Auth's own token generation,
 * persistence, expiry, or consumption logic anywhere in this file.
 *
 * Token extraction mirrors email-verification.test.ts's own precedent
 * exactly: pull the real, emailed token out of the real queued job's `url`
 * field (`new URL(job.data.url)`), never out of Better Auth internals.
 * Better Auth's own url shape for this flow is a path segment, not a query
 * param - `${baseURL}/reset-password/:token?callbackURL=...` - unlike
 * verify-email's `?token=`, hence `.pathname.split("/").pop()` below
 * instead of `.searchParams.get("token")`.
 */
describe("password reset", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  // Deliberately not `async` - supertest's Test object is itself thenable
  // (awaitable directly) but also chainable (`.expect(...)`); wrapping it in
  // an async function would resolve it to a plain Response first, losing
  // the ability for callers to chain `.expect()` off this helper's result.
  function requestReset(email: string) {
    return request(app).post("/api/auth/request-password-reset").send({ email });
  }

  async function extractResetToken(email: string): Promise<string> {
    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);

    const job = jobs.find(
      (candidate) =>
        candidate.name === EMAIL_JOB_NAMES.PASSWORD_RESET && candidate.data?.email === email,
    );

    if (!job) {
      throw new Error(`No queued password-reset job found for ${email}`);
    }

    const token = new URL(job.data.url).pathname.split("/").pop();

    if (!token) {
      throw new Error("Queued password-reset job's url had no token segment");
    }

    return token;
  }

  it("allows an unauthenticated request to initiate password recovery", async () => {
    const user = await signUpTestUser(app);

    const res = await requestReset(user.email);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
  });

  it("does not reveal whether the email is registered", async () => {
    const user = await signUpTestUser(app);
    const nonexistentEmail = `nonexistent-${crypto.randomUUID()}@example.com`;

    const existingRes = await requestReset(user.email);
    const nonexistentRes = await requestReset(nonexistentEmail);

    expect(existingRes.status).toBe(nonexistentRes.status);
    expect(existingRes.body).toEqual(nonexistentRes.body);
  });

  it("enqueues a password-reset email job with what the worker needs, for an existing account", async () => {
    const user = await signUpTestUser(app);

    await requestReset(user.email).expect(200);

    const jobs = await emailQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const job = jobs.find(
      (candidate) =>
        candidate.name === EMAIL_JOB_NAMES.PASSWORD_RESET && candidate.data?.email === user.email,
    );

    expect(job).toBeTruthy();
    expect(job!.data.name).toBe("Test User");
    expect(typeof job!.data.url).toBe("string");
    expect(job!.data.url).toContain("/reset-password/");
  });

  it("rejects an invalid/unknown token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "totally-bogus-nonexistent-token", newPassword: "newpassword5678" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("rejects a token whose expiry has already passed", async () => {
    const user = await signUpTestUser(app);

    await requestReset(user.email).expect(200);
    const token = await extractResetToken(user.email);

    // Directly backdating the real Verification row Better Auth itself
    // created (via the exact `reset-password:${token}` identifier scheme
    // read from the installed better-auth package's own source) is
    // deterministic, unlike a sleep-based wait for a real 1-hour token to
    // actually expire. This is the same class of "manipulate known,
    // Prisma-exposed table state directly" technique already used
    // throughout this test suite (e.g. signUpTestUser's own
    // prisma.user.update to skip real email verification) - not private
    // Better Auth internals, since `verification` is an ordinary Prisma
    // model this whole app already reads/writes.
    await prisma.verification.updateMany({
      where: { identifier: `reset-password:${token}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "newpassword5678" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("rejects reusing a token that has already been consumed", async () => {
    const user = await signUpTestUser(app);

    await requestReset(user.email).expect(200);
    const token = await extractResetToken(user.email);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "newpassword5678" })
      .expect(200);

    const reuseRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "yetanotherpassword9" });

    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.code).toBe("INVALID_TOKEN");
  });

  it("changes the password end-to-end: the old password stops working and the new one works", async () => {
    const user = await signUpTestUser(app);
    const newPassword = "brandnewpassword5678";

    await requestReset(user.email).expect(200);
    const token = await extractResetToken(user.email);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword })
      .expect(200);

    const oldPasswordRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: user.password });

    expect(oldPasswordRes.status).not.toBe(200);
    expect(oldPasswordRes.headers["set-cookie"]).toBeUndefined();

    const newPasswordRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: newPassword })
      .expect(200);

    expect(newPasswordRes.headers["set-cookie"]).toBeTruthy();
  });

  it("revokes the user's existing sessions once the password is reset", async () => {
    const user = await signUpTestUser(app);

    // Confirms the pre-reset session genuinely works before relying on its
    // absence proving anything below.
    await request(app).get("/api/v1/workspaces").set("Cookie", user.cookie).expect(200);

    await requestReset(user.email).expect(200);
    const token = await extractResetToken(user.email);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "brandnewpassword5678" })
      .expect(200);

    await request(app).get("/api/v1/workspaces").set("Cookie", user.cookie).expect(401);
  });
});
