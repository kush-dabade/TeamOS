import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";

// Mirrors src/lib/auth.ts's SIGN_IN_ACCOUNT_LIMIT - see rate-limit.test.ts's
// own GENERAL_LIMIT/SEARCH_LIMIT etc. for the same "pin the real number
// here" rationale. Deliberately well under signInIpLimiter's 20/min (see
// auth-rate-limit.test.ts) so no test in this file risks the IP-scoped
// limiter's 429 masking the account-scoped one under test here.
const ACCOUNT_LIMIT = 5;

const PASSWORD = "password1234";
const WRONG_PASSWORD = "not-the-password";

function uniqueEmail(label: string): string {
  return `acct-rl-${label}-${crypto.randomUUID()}@example.com`;
}

/** Signs up and verifies a user without also signing in - keeps full
 * control over how many sign-in attempts each test makes against the
 * account, rather than fixtures.ts's signUpTestUser silently consuming one.
 */
async function createVerifiedUser(email: string): Promise<void> {
  const res = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ name: "Account RL Test", email, password: PASSWORD })
    .expect(200);

  await prisma.user.update({
    where: { id: res.body.user.id as string },
    data: { emailVerified: true },
  });
}

function signIn(email: string, password: string) {
  return request(app).post("/api/auth/sign-in/email").send({ email, password });
}

describe("auth rate limiting (account-scoped, sign-in only)", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await resetDatabase();
    // rl:auth:signin:account:* keys are cleared automatically by the
    // global afterEach in tests/setup/rate-limit-cleanup-hook.ts, which
    // scans/deletes every key under the shared "rl:" prefix this limiter
    // also uses (see src/lib/redis.ts's incrementRateLimitCounter and
    // signInAccountRateLimitKey in src/lib/auth.ts).
  });

  it("allows attempts up to the limit and blocks the one after, regardless of outcome", async () => {
    const email = uniqueEmail("boundary");
    await createVerifiedUser(email);

    // Five failed attempts (wrong password) - each still under the limit,
    // so each fails for the ordinary "wrong credentials" reason, not as
    // rate-limited.
    for (let i = 0; i < ACCOUNT_LIMIT; i++) {
      const res = await signIn(email, WRONG_PASSWORD);
      expect(res.status).not.toBe(429);
    }

    // The 6th attempt against this account is blocked before Better Auth
    // even checks the password - proven by using the *correct* password
    // here and still getting 429, not 200.
    const blocked = await signIn(email, PASSWORD);

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("RATE_LIMITED");
  });

  it("normalizes email case/whitespace into one shared bucket", async () => {
    const email = uniqueEmail("norm");
    await createVerifiedUser(email);

    const variants = [
      email.toUpperCase(),
      `  ${email}  `,
      email.replace("@example.com", "@Example.Com"),
      email,
      email.toUpperCase(),
    ];

    expect(variants).toHaveLength(ACCOUNT_LIMIT);

    for (const variant of variants) {
      const res = await signIn(variant, WRONG_PASSWORD);
      expect(res.status).not.toBe(429);
    }

    // A 6th attempt, in yet another casing, still lands in the same
    // bucket as the five above - if normalization didn't merge them, this
    // would just be attempt #1 of a fresh bucket and succeed/fail
    // normally instead of being blocked.
    const blocked = await signIn(email.toUpperCase(), PASSWORD);

    expect(blocked.status).toBe(429);
  });

  it("keeps different accounts independent, and a blocked account doesn't block others from the same connection", async () => {
    const blockedEmail = uniqueEmail("blocked");
    const otherEmail = uniqueEmail("other");
    await createVerifiedUser(blockedEmail);
    await createVerifiedUser(otherEmail);

    for (let i = 0; i < ACCOUNT_LIMIT; i++) {
      await signIn(blockedEmail, WRONG_PASSWORD);
    }

    const blocked = await signIn(blockedEmail, PASSWORD);
    expect(blocked.status).toBe(429);

    // Same test connection/IP as every request above, a completely
    // different account - the account limiter's Redis key
    // (rl:auth:signin:account:<email>) never incorporates the IP or any
    // connection identity at all (see signInAccountRateLimitKey in
    // src/lib/auth.ts), so this succeeding proves the block above was
    // scoped to blockedEmail's bucket specifically, not the connection it
    // came from.
    const otherResult = await signIn(otherEmail, PASSWORD);
    expect(otherResult.status).toBe(200);
  });

  it("does not carry a successful sign-in's slot into the account's failure count", async () => {
    const email = uniqueEmail("refund");
    await createVerifiedUser(email);

    // Four failed attempts - one below the limit.
    for (let i = 0; i < ACCOUNT_LIMIT - 1; i++) {
      const res = await signIn(email, WRONG_PASSWORD);
      expect(res.status).not.toBe(429);
    }

    // The 5th attempt succeeds (correct password) - per the boundary test
    // above, this would otherwise have been the last attempt allowed
    // before a block.
    const success = await signIn(email, PASSWORD);
    expect(success.status).toBe(200);

    // If the successful attempt's slot had been left consumed, the
    // account would already be at its limit (5 used) and this loop would
    // start hitting 429 immediately. Instead, the success above cleared
    // the bucket, so this account gets a fresh five attempts again.
    for (let i = 0; i < ACCOUNT_LIMIT; i++) {
      const res = await signIn(email, WRONG_PASSWORD);
      expect(res.status).not.toBe(429);
    }

    const blocked = await signIn(email, PASSWORD);
    expect(blocked.status).toBe(429);
  });

  it("still applies the IP-scoped sign-in limiter independently, on top of the account limiter", async () => {
    const email = uniqueEmail("ip-still-active");
    await createVerifiedUser(email);

    // A normal, well-under-both-limits sign-in still carries the
    // Express-level signInIpLimiter's headers (see
    // middleware/rate-limit.ts) - proves adding the account-scoped,
    // Better-Auth-hook-based limiter didn't replace or bypass the
    // existing IP-scoped Express middleware from Commit 2, the two layers
    // simply both apply to the same request.
    const res = await signIn(email, PASSWORD).expect(200);

    expect(res.headers["ratelimit-limit"]).toBe("20");
  });
});
