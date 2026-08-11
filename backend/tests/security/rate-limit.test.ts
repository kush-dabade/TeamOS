import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";
import { seedRateLimitCount } from "../setup/reset-rate-limits.js";
import { createWorkspaceWithMember, signUpTestUser } from "../setup/fixtures.js";

// Mirrors the configured limits in src/middleware/rate-limit.ts - these
// tests exist specifically to pin those numbers, so hardcoding them here is
// intentional: a change to the real limit should make this test fail until
// it's updated to match, not silently stop verifying anything.
const GENERAL_LIMIT = 300;
const SEARCH_LIMIT = 20;
const UPLOAD_LIMIT = 10;

const RATE_LIMITED_ENVELOPE = {
  success: false,
  error: { code: "RATE_LIMITED", message: expect.any(String) },
};

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
});
