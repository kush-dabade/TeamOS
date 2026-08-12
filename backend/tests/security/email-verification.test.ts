import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
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
});
