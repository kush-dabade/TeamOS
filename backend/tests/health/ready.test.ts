import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";

describe("GET /health", () => {
  it("still returns the plain liveness response, unchanged by the /ready addition", async () => {
    const res = await request(app).get("/health").expect(200);

    expect(res.body).toEqual({ success: true, message: "TeamOS API is running" });
  });
});

describe("GET /ready", () => {
  it("returns 200 with both checks ok against the real Postgres/Redis test environment", async () => {
    const res = await request(app).get("/ready").expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.checks.database.ok).toBe(true);
    expect(typeof res.body.checks.database.latencyMs).toBe("number");
    expect(res.body.checks.redis.ok).toBe(true);
    expect(typeof res.body.checks.redis.latencyMs).toBe("number");
  });

  it("sets X-Request-Id on the response, same as every other route since Commit 3", async () => {
    const res = await request(app).get("/ready").expect(200);

    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});
