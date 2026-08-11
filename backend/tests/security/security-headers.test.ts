import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { seedRateLimitCount } from "../setup/reset-rate-limits.js";
import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HSTS_CHECK_SCRIPT = path.join(backendRoot, "tests/setup/hsts-production-check.ts");

const EXPECTED_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
};

function expectSecurityHeaders(res: request.Response) {
  for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
    expect(res.headers[name]).toBe(value);
  }
}

describe("security headers", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await resetDatabase();
    // Redis rate-limit counters are cleared automatically by the global
    // afterEach in tests/setup/rate-limit-cleanup-hook.ts.
  });

  it("sets all four headers on a normal 200 response", async () => {
    const { cookie } = await signUpTestUser(app);

    const res = await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(200);

    expectSecurityHeaders(res);
  });

  it("sets all four headers on a 401 (no session)", async () => {
    const res = await request(app).get("/api/v1/workspaces").expect(401);

    expectSecurityHeaders(res);
  });

  it("sets all four headers on a 403 (non-member access)", async () => {
    const owner = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(owner.userId);
    const outsider = await signUpTestUser(app);

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspace.id}/members`)
      .set("Cookie", outsider.cookie)
      .expect(403);

    expectSecurityHeaders(res);
  });

  it("sets all four headers on a 404 (unknown route)", async () => {
    const { cookie } = await signUpTestUser(app);

    const res = await request(app)
      .get("/api/v1/this-route-does-not-exist")
      .set("Cookie", cookie)
      .expect(404);

    expectSecurityHeaders(res);
  });

  it("sets all four headers on a 429 (rate limited)", async () => {
    const { userId, cookie } = await signUpTestUser(app);

    // Reuses the same seed-to-boundary approach as rate-limit.test.ts - the
    // point here is proving header survival on an error path, not
    // re-verifying RateLimit-* behavior, which that file already covers.
    await seedRateLimitCount("rl:general:", `user:${userId}`, 300);

    const res = await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(429);

    expectSecurityHeaders(res);
  });

  it("does not send Strict-Transport-Security in development", async () => {
    const { cookie } = await signUpTestUser(app);

    const res = await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(200);

    // The whole suite runs under the test environment's configuration
    // (NODE_ENV unset -> "development", see config/security.config.ts),
    // so this is the same in-process app every other test in this file
    // uses - no special isolation needed for the negative case.
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sends Strict-Transport-Security with the configured max-age in production", async () => {
    // isProduction is a module-level const in config/security.config.ts,
    // computed once at first import from process.env.NODE_ENV - it can't
    // be flipped mid-suite by mutating process.env, and doing so risks
    // leaking into other test files depending on Vitest's worker reuse.
    // A genuinely separate process (see hsts-production-check.ts) sidesteps
    // that assumption entirely instead of relying on it.
    const { stdout } = await execFileAsync("npx", ["tsx", HSTS_CHECK_SCRIPT], {
      cwd: backendRoot,
      env: { ...process.env, NODE_ENV: "production" },
    });

    expect(stdout.trim()).toBe("max-age=15552000");
  });
});
