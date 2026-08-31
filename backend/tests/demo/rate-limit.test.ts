import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "../setup/reset-database.js";
import { startTestServer, type TestServer } from "../setup/test-server.js";

// Mirrors the configured limit in src/middleware/rate-limit.ts's
// demoSessionLimiter - see that file's own comment for why this is
// deliberately tighter than signUpIpLimiter's 10/min. Pinning the real
// number here, same convention as tests/security/rate-limit.test.ts and
// auth-rate-limit.test.ts's GENERAL_LIMIT/SIGN_UP_LIMIT etc.
const DEMO_SESSION_LIMIT = 5;

const RATE_LIMITED_ENVELOPE = {
  success: false,
  error: { code: "RATE_LIMITED", message: expect.any(String) },
};

describe("demo session provisioning rate limiting", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await resetDatabase();
    // Redis rate-limit counters (rl:demo:session:*) are cleared
    // automatically by the global afterEach in
    // tests/setup/rate-limit-cleanup-hook.ts.
  });

  it(
    "allows provisioning up to the limit, blocks the next request with 429, and never provisions past the limit",
    async () => {
      // Real requests, not seeded counters - DEMO_SESSION_LIMIT (5) is
      // small enough to drive directly, and this exercises the real
      // middleware/Redis path, not an approximation of it. Each one is a
      // genuine full provisioning call (user + workspace + seed data), the
      // same real-cost work an actual abusive burst would trigger.
      for (let i = 0; i < DEMO_SESSION_LIMIT; i++) {
        await request(app).post("/api/v1/demo/session").expect(201);
      }

      const provisionedCount = await prisma.user.count({ where: { isDemo: true } });

      expect(provisionedCount).toBe(DEMO_SESSION_LIMIT);

      const blockedRes = await request(app).post("/api/v1/demo/session").expect(429);

      expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
      expect(blockedRes.headers["retry-after"]).toBeTruthy();
      expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);
      expect(blockedRes.headers["ratelimit-limit"]).toBe(String(DEMO_SESSION_LIMIT));
      expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");

      // Proves the limiter runs BEFORE provisioning (demo.routes.ts mounts
      // it as the first middleware, ahead of the controller) - if
      // provisioning ran first and the limiter only blocked the response,
      // this count would have incremented to 6 despite the 429.
      const countAfterBlockedRequest = await prisma.user.count({ where: { isDemo: true } });

      expect(countAfterBlockedRequest).toBe(DEMO_SESSION_LIMIT);
    },
    // 5 full provisioning calls (each creating a user, workspace, 3
    // projects, 9 tasks, a sprint, and 2 comments through the real service
    // layer) comfortably exceed vitest.config.ts's default 15s testTimeout.
    30_000,
  );
});
