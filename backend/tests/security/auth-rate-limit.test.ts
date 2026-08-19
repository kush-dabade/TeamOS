import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { signUpTestUser } from "../setup/fixtures.js";

// Mirrors the configured limits in src/middleware/rate-limit.ts - see
// rate-limit.test.ts's own GENERAL_LIMIT/SEARCH_LIMIT etc. for the same
// "pin the real number here" rationale.
const SIGN_IN_LIMIT = 20;
const SIGN_UP_LIMIT = 10;

const RATE_LIMITED_ENVELOPE = {
  success: false,
  error: { code: "RATE_LIMITED", message: expect.any(String) },
};

const PASSWORD = "password1234";

function uniqueEmail(): string {
  return `auth-rl-${crypto.randomUUID()}@example.com`;
}

describe("auth rate limiting (IP-scoped)", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await resetDatabase();
    // Redis rate-limit counters (rl:auth:signin:ip:*, rl:auth:signup:ip:*)
    // are cleared automatically by the global afterEach in
    // tests/setup/rate-limit-cleanup-hook.ts, which scans/deletes every
    // key under the shared "rl:" prefix these limiters also use.
  });

  it("allows sign-up requests up to the limit and blocks the one after", async () => {
    // SIGN_UP_LIMIT is small enough (10) to drive with real requests rather
    // than seeding - each needs its own unique email since sign-up itself
    // rejects a duplicate address independently of rate limiting, and a
    // real request here exercises the actual middleware/Redis path this
    // test is meant to prove, not a fast-forwarded approximation of it.
    for (let i = 0; i < SIGN_UP_LIMIT; i++) {
      await request(app)
        .post("/api/auth/sign-up/email")
        .send({ name: "Auth RL Test", email: uniqueEmail(), password: PASSWORD })
        .expect(200);
    }

    const blockedRes = await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Auth RL Test", email: uniqueEmail(), password: PASSWORD })
      .expect(429);

    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
    expect(blockedRes.headers["retry-after"]).toBeTruthy();
    expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);
    expect(blockedRes.headers["ratelimit-limit"]).toBe(String(SIGN_UP_LIMIT));
    expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
  });

  it("allows sign-in requests up to the limit and blocks the one after", async () => {
    const email = uniqueEmail();
    await createVerifiedUser(email);

    for (let i = 0; i < SIGN_IN_LIMIT; i++) {
      await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email, password: PASSWORD })
        .expect(200);
    }

    const blockedRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password: PASSWORD })
      .expect(429);

    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
    expect(blockedRes.headers["retry-after"]).toBeTruthy();
    expect(blockedRes.headers["ratelimit-limit"]).toBe(String(SIGN_IN_LIMIT));
    expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
  });

  it("keeps sign-in and sign-up buckets independent (same source IP)", async () => {
    // Verified user created *before* exhausting sign-up below - createVerifiedUser
    // itself performs a sign-up call, which would otherwise also be blocked
    // once sign-up's own bucket is exhausted, since both come from the same
    // test connection/IP.
    const email = uniqueEmail();
    await createVerifiedUser(email);

    // Exhausts sign-up's bucket entirely (one slot already spent above),
    // then proves sign-in from the same test connection (same IP) is
    // unaffected - the two limiters use distinct Redis key prefixes
    // (rl:auth:signup:ip: vs rl:auth:signin:ip:), so this is only true if
    // that separation holds.
    for (let i = 0; i < SIGN_UP_LIMIT - 1; i++) {
      await request(app)
        .post("/api/auth/sign-up/email")
        .send({ name: "Auth RL Test", email: uniqueEmail(), password: PASSWORD })
        .expect(200);
    }

    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Auth RL Test", email: uniqueEmail(), password: PASSWORD })
      .expect(429);

    // Sign-in still succeeds - proves it wasn't affected by sign-up's
    // exhausted bucket.
    await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password: PASSWORD })
      .expect(200);
  });

  it("does not rate-limit unrelated /api/auth/* endpoints", async () => {
    const email = uniqueEmail();
    await createVerifiedUser(email);

    // Exhausts the sign-in limiter entirely.
    for (let i = 0; i < SIGN_IN_LIMIT; i++) {
      await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email, password: PASSWORD })
        .expect(200);
    }

    await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password: PASSWORD })
      .expect(429);

    // A completely different /api/auth/* endpoint, reached only through the
    // Better Auth catch-all (app.all("/api/auth/*splat", ...)), not through
    // either new path-scoped limiter - must not be 429 just because
    // sign-in's bucket is exhausted.
    const sessionRes = await request(app).get("/api/auth/get-session");

    expect(sessionRes.status).not.toBe(429);
  });

  it("still allows normal sign-up/sign-in flows well under the limit", async () => {
    // Regression check: signUpTestUser (used by nearly every other test
    // file in this suite) does exactly one sign-up and one sign-in, both
    // comfortably under SIGN_UP_LIMIT/SIGN_IN_LIMIT - this is the same
    // fixture every pre-existing auth-dependent test relies on, exercised
    // here directly against the now-rate-limited paths.
    const { userId, cookie } = await signUpTestUser(app);

    expect(userId).toBeTruthy();
    expect(cookie).toContain("=");
  });

  /**
   * Signs up and verifies a user without also signing in - lets the
   * sign-in tests above control the exact number of sign-in calls
   * themselves (signUpTestUser always performs one sign-in as part of
   * returning a session, which would silently consume one slot of
   * SIGN_IN_LIMIT before the test's own loop starts).
   */
  async function createVerifiedUser(email: string): Promise<void> {
    const res = await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Auth RL Test", email, password: PASSWORD })
      .expect(200);

    await prisma.user.update({
      where: { id: res.body.user.id as string },
      data: { emailVerified: true },
    });
  }
});
