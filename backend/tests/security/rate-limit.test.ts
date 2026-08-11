import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Redis } from "ioredis";

import app from "../../src/app.js";
import { rateLimitRedis } from "../../src/lib/redis.js";
import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { seedRateLimitCount } from "../setup/reset-rate-limits.js";
import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

/**
 * Bounded, event-driven wait for `client` to reach "ready" - no arbitrary
 * sleep. Used only to make sure this file's Redis-outage test hands a fully
 * reconnected client back to whichever test runs next, not "reconnection
 * kicked off, hope it lands in time."
 */
function waitForReady(client: Redis, timeoutMs = 2000): Promise<void> {
  if (client.status === "ready") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("ready", onReady);
      reject(new Error("Timed out waiting for rateLimitRedis to reconnect"));
    }, timeoutMs);

    function onReady() {
      clearTimeout(timer);
      resolve();
    }

    client.once("ready", onReady);
  });
}

// Mirrors the configured limits in src/middleware/rate-limit.ts - these
// tests exist specifically to pin those numbers, so hardcoding them here is
// intentional: a change to the real limit should make this test fail until
// it's updated to match, not silently stop verifying anything.
const GENERAL_LIMIT = 300;
const SEARCH_LIMIT = 20;
const UPLOAD_LIMIT = 10;
const INVITATION_LIMIT = 10;
const AVATAR_LIMIT = 10;

const RATE_LIMITED_ENVELOPE = {
  success: false,
  error: { code: "RATE_LIMITED", message: expect.any(String) },
};

// A minimal, valid PNG - real bytes, not a mock, so multer's own handling
// of the upload is exercised for real, same as the existing upload test.
const AVATAR_PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("rate limiting", () => {
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

  it("allows the boundary request and returns 429 with the standard envelope once exceeded", async () => {
    const { userId, cookie } = await signUpTestUser(app);

    // Fast-forwards to one below the limit instead of sending 299 requests
    // - see reset-rate-limits.ts for why this still exercises the real
    // middleware/Redis path for the two requests that matter.
    await seedRateLimitCount("rl:general:", `user:${userId}`, GENERAL_LIMIT - 1);

    const boundaryRes = await request(app)
      .get("/api/v1/workspaces")
      .set("Cookie", cookie)
      .expect(200);

    expect(boundaryRes.headers["ratelimit-limit"]).toBe(String(GENERAL_LIMIT));
    expect(boundaryRes.headers["ratelimit-remaining"]).toBe("0");

    const blockedRes = await request(app)
      .get("/api/v1/workspaces")
      .set("Cookie", cookie)
      .expect(429);

    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
    expect(blockedRes.headers["retry-after"]).toBeTruthy();
    expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);
    expect(blockedRes.headers["ratelimit-limit"]).toBe(String(GENERAL_LIMIT));
    expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
  });

  it("enforces the tighter search limit independently of the general limiter", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(userId);

    // A valid query - searchQuerySchema requires q (>=2 chars) and a real
    // workspaceId, so an underspecified request would 400 before ever
    // reaching the limiter, not prove anything about rate limiting.
    const searchUrl = `/api/v1/search?q=test&workspaceId=${workspace.id}`;

    await seedRateLimitCount("rl:search:", `user:${userId}`, SEARCH_LIMIT - 1);

    const boundaryRes = await request(app).get(searchUrl).set("Cookie", cookie).expect(200);
    expect(boundaryRes.headers["ratelimit-limit"]).toBe(String(SEARCH_LIMIT));
    expect(boundaryRes.headers["ratelimit-remaining"]).toBe("0");

    const blockedRes = await request(app).get(searchUrl).set("Cookie", cookie).expect(429);
    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
    expect(blockedRes.headers["retry-after"]).toBeTruthy();
    expect(blockedRes.headers["ratelimit-limit"]).toBe(String(SEARCH_LIMIT));
    expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");

    // Independent bucket/prefix: the search limiter being exhausted must
    // not affect the general limiter's own counter for the same user.
    await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(200);
  });

  it("enforces the upload limit independently and preserves upload/download behavior", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(userId);

    const projectRes = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects`)
      .set("Cookie", cookie)
      .send({ name: "Rate Limit Test Project", ownerId: userId })
      .expect(201);
    const projectId = projectRes.body.data.id;

    const taskRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Rate limit test task" })
      .expect(201);
    const taskId = taskRes.body.data.id;

    await seedRateLimitCount("rl:upload:", `user:${userId}`, UPLOAD_LIMIT - 1);

    // Boundary upload - still allowed, and doubles as the "upload/download
    // still works" regression check (Commit 6 didn't touch this path, but
    // this is where it's proven with a real round trip and real content).
    const uploadRes = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set("Cookie", cookie)
      .attach("file", Buffer.from("hello world"), "note.txt")
      .expect(201);
    expect(uploadRes.headers["ratelimit-limit"]).toBe(String(UPLOAD_LIMIT));
    expect(uploadRes.headers["ratelimit-remaining"]).toBe("0");

    const attachmentId = uploadRes.body.data.attachment.id;

    const downloadRes = await request(app)
      .get(`/api/v1/attachments/${attachmentId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(downloadRes.text).toBe("hello world");
    expect(downloadRes.headers["content-disposition"]).toContain('filename="note.txt"');

    const blockedRes = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set("Cookie", cookie)
      .attach("file", Buffer.from("should be blocked"), "blocked.txt")
      .expect(429);
    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);

    // Independent bucket/prefix: exhausting uploads must not affect the
    // general limiter's own counter for the same user.
    await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(200);
  });

  it("keeps rate-limit buckets separate per authenticated user", async () => {
    const userA = await signUpTestUser(app);
    const userB = await signUpTestUser(app);

    await seedRateLimitCount("rl:general:", `user:${userA.userId}`, GENERAL_LIMIT);

    // A is already at the limit - the very next request is blocked.
    await request(app).get("/api/v1/workspaces").set("Cookie", userA.cookie).expect(429);

    // B is a completely different identity with its own key (`user:<B's
    // id>`) - proves buckets are per-user, not shared globally.
    await request(app).get("/api/v1/workspaces").set("Cookie", userB.cookie).expect(200);
  });

  it("shares one bucket for the same user across different workspaces", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace: workspaceA } = await createWorkspaceWithMember(userId);
    const { workspace: workspaceB } = await createWorkspaceWithMember(userId);

    await seedRateLimitCount("rl:general:", `user:${userId}`, GENERAL_LIMIT - 1);

    // Boundary request scoped to workspace A - still allowed.
    await request(app)
      .get(`/api/v1/workspaces/${workspaceA.id}/members`)
      .set("Cookie", cookie)
      .expect(200);

    // Same user, a DIFFERENT workspace - still blocked, because the key is
    // `user:<id>` only (see resolveGeneralLimiterKey in
    // middleware/rate-limit.ts) and never incorporates workspaceId. This is
    // the architectural invariant Commit 5 established: switching which
    // workspace a user acts on cannot reset or split their bucket.
    await request(app)
      .get(`/api/v1/workspaces/${workspaceB.id}/members`)
      .set("Cookie", cookie)
      .expect(429);
  });

  it("enforces the invitation limit on invitation creation", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(userId);

    await seedRateLimitCount("rl:invitations:", `user:${userId}`, INVITATION_LIMIT - 1);

    const boundaryRes = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", cookie)
      .send({ email: `invitee-${crypto.randomUUID()}@example.com`, role: "MEMBER" })
      .expect(201);
    expect(boundaryRes.headers["ratelimit-limit"]).toBe(String(INVITATION_LIMIT));
    expect(boundaryRes.headers["ratelimit-remaining"]).toBe("0");

    const blockedRes = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", cookie)
      .send({ email: `invitee-${crypto.randomUUID()}@example.com`, role: "MEMBER" })
      .expect(429);
    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
    expect(blockedRes.headers["retry-after"]).toBeTruthy();
    expect(blockedRes.headers["ratelimit-limit"]).toBe(String(INVITATION_LIMIT));
    expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
  });

  it("enforces the invitation limit on resend, sharing the same bucket as creation", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(userId);

    // Direct insert, not the rate-limited HTTP creation endpoint - creating
    // this pending invitation via HTTP would itself consume this test's
    // seeded budget. Same "direct data insert for setup, real HTTP for the
    // assertion" philosophy fixtures.ts already uses.
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: workspace.id,
        email: `resend-target-${crypto.randomUUID()}@example.com`,
        role: WorkspaceRole.MEMBER,
        invitedById: userId,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Seeded on the same rl:invitations: prefix invitationLimiter uses for
    // both routes - reaching the boundary via resend calls proves create
    // and resend genuinely share one bucket, not just that each
    // independently respects its own copy of the same number.
    await seedRateLimitCount("rl:invitations:", `user:${userId}`, INVITATION_LIMIT - 1);

    const resendUrl = `/api/v1/workspaces/${workspace.id}/invitations/${invitation.id}/resend`;

    const boundaryRes = await request(app).post(resendUrl).set("Cookie", cookie).expect(200);
    expect(boundaryRes.headers["ratelimit-limit"]).toBe(String(INVITATION_LIMIT));
    expect(boundaryRes.headers["ratelimit-remaining"]).toBe("0");

    const blockedRes = await request(app).post(resendUrl).set("Cookie", cookie).expect(429);
    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
    expect(blockedRes.headers["retry-after"]).toBeTruthy();
    expect(blockedRes.headers["ratelimit-limit"]).toBe(String(INVITATION_LIMIT));
    expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
  });

  it("enforces the avatar upload limit", async () => {
    const { userId, cookie } = await signUpTestUser(app);

    await seedRateLimitCount("rl:avatar:", `user:${userId}`, AVATAR_LIMIT - 1);

    const boundaryRes = await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Cookie", cookie)
      .attach("file", AVATAR_PNG_BYTES, { filename: "avatar.png", contentType: "image/png" })
      .expect(200);
    expect(boundaryRes.headers["ratelimit-limit"]).toBe(String(AVATAR_LIMIT));
    expect(boundaryRes.headers["ratelimit-remaining"]).toBe("0");

    const blockedRes = await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Cookie", cookie)
      .attach("file", AVATAR_PNG_BYTES, { filename: "avatar-2.png", contentType: "image/png" })
      .expect(429);
    expect(blockedRes.body).toEqual(RATE_LIMITED_ENVELOPE);
    expect(blockedRes.headers["retry-after"]).toBeTruthy();
    expect(blockedRes.headers["ratelimit-limit"]).toBe(String(AVATAR_LIMIT));
    expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
  });

  it("keeps the invitation bucket independent from the general/search/upload/avatar buckets", async () => {
    const { userId, cookie } = await signUpTestUser(app);
    const { workspace } = await createWorkspaceWithMember(userId);

    await seedRateLimitCount("rl:invitations:", `user:${userId}`, INVITATION_LIMIT);

    // Invitation bucket is now exhausted.
    await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set("Cookie", cookie)
      .send({ email: `invitee-${crypto.randomUUID()}@example.com`, role: "MEMBER" })
      .expect(429);

    // General bucket unaffected - different prefix/key.
    await request(app).get("/api/v1/workspaces").set("Cookie", cookie).expect(200);

    // Search bucket unaffected.
    await request(app)
      .get(`/api/v1/search?q=test&workspaceId=${workspace.id}`)
      .set("Cookie", cookie)
      .expect(200);

    // Upload bucket unaffected.
    const projectRes = await request(app)
      .post(`/api/v1/workspaces/${workspace.id}/projects`)
      .set("Cookie", cookie)
      .send({ name: "Invitation Independence Project", ownerId: userId })
      .expect(201);
    const projectId = projectRes.body.data.id;

    const taskRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Invitation independence task" })
      .expect(201);
    const taskId = taskRes.body.data.id;

    await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set("Cookie", cookie)
      .attach("file", Buffer.from("independent"), "note.txt")
      .expect(201);

    // Avatar bucket unaffected.
    await request(app)
      .post("/api/v1/users/me/avatar")
      .set("Cookie", cookie)
      .attach("file", AVATAR_PNG_BYTES, { filename: "avatar.png", contentType: "image/png" })
      .expect(200);
  });

  it("fails open quickly when the rate-limit Redis store is unavailable", async () => {
    const { cookie } = await signUpTestUser(app);

    const originalHost = rateLimitRedis.options.host;
    const originalPort = rateLimitRedis.options.port;

    try {
      // Redirects only the dedicated rate-limit connection to an
      // unreachable local target (nothing listens on 127.0.0.1:1) - the
      // real dev Redis, BullMQ's own connection, and the test Postgres are
      // all untouched. disconnect(true) is ioredis's own signal for an
      // involuntary drop that should keep retrying (as opposed to
      // disconnect()'s default "give up, don't reconnect"), verified
      // against ioredis's source to put the client into an actively
      // reconnecting state - so the next command goes through the same
      // queued-command path a real outage would, exercising
      // commandTimeout for real rather than hitting the instant
      // "Connection is closed" shortcut a fully-closed client takes.
      rateLimitRedis.options.host = "127.0.0.1";
      rateLimitRedis.options.port = 1;
      rateLimitRedis.disconnect(true);

      const start = Date.now();

      // A bound independent of Vitest's own test timeout - if the fix
      // regresses to the old ~10s failure mode, this rejects well before
      // that and the test fails fast instead of eventually timing out.
      const response = await Promise.race([
        request(app).get("/api/v1/workspaces").set("Cookie", cookie),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request exceeded the 3s fail-open bound")), 3000),
        ),
      ]);

      const elapsed = Date.now() - start;

      // The request must succeed normally, not fail closed (500) and not
      // be treated as rate-limited (429) just because the store errored.
      expect(response.status).not.toBe(429);
      expect(response.status).not.toBe(500);
      expect(response.status).toBe(200);

      // Well under the old ~10s failure mode, comfortably above the 500ms
      // commandTimeout to avoid flaking on CI-level scheduling jitter.
      expect(elapsed).toBeLessThan(2000);
    } finally {
      // Restored even if an assertion above throws - a failed assertion
      // must not leave the shared connection pointed at a dead target for
      // the rest of this file's tests.
      rateLimitRedis.options.host = originalHost;
      // ioredis's declared RedisOptions type allows `port` to be optional
      // on read (hence `number | undefined` here) but not on write for
      // this client's inferred options shape - always defined at runtime
      // (see lib/redis.ts's construction), hence the assertion.
      rateLimitRedis.options.port = originalPort!;
      rateLimitRedis.disconnect(true);
      await waitForReady(rateLimitRedis);
    }
  });
});
