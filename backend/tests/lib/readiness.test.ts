import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { checkDatabase, checkRedis, createReadinessHandler } from "../../src/lib/readiness.js";

describe("checkDatabase", () => {
  it("reports ok:true with a latency measurement when the query succeeds", async () => {
    const fakeClient = { $queryRaw: async () => [{ ok: 1 }] };

    const result = await checkDatabase(fakeClient);

    expect(result.ok).toBe(true);
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports ok:false and never leaks the underlying error into the result when the query rejects", async () => {
    const fakeClient = {
      $queryRaw: async () => {
        throw new Error("connection to server at password=supersecret123 failed");
      },
    };

    const result = await checkDatabase(fakeClient);

    expect(result.ok).toBe(false);
    expect(Object.keys(result).sort()).toEqual(["latencyMs", "ok"]);
    expect(JSON.stringify(result)).not.toContain("supersecret123");
  });

  it("times out and reports ok:false when the query never settles", async () => {
    const fakeClient = { $queryRaw: () => new Promise<unknown>(() => {}) };

    const result = await checkDatabase(fakeClient);

    expect(result.ok).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(999);
  }, 2000);
});

describe("checkRedis", () => {
  it("reports ok:true with a latency measurement when ping succeeds", async () => {
    const fakeClient = { ping: async () => "PONG" };

    const result = await checkRedis(fakeClient);

    expect(result.ok).toBe(true);
    expect(typeof result.latencyMs).toBe("number");
  });

  it("reports ok:false and never leaks the underlying error into the result when ping rejects", async () => {
    const fakeClient = {
      ping: async () => {
        throw new Error("ECONNREFUSED redis://:secretpass@127.0.0.1:6379");
      },
    };

    const result = await checkRedis(fakeClient);

    expect(result.ok).toBe(false);
    expect(Object.keys(result).sort()).toEqual(["latencyMs", "ok"]);
    expect(JSON.stringify(result)).not.toContain("secretpass");
  });
});

function buildReadyApp(options: Parameters<typeof createReadinessHandler>[0]) {
  const app = express();
  app.get("/ready", createReadinessHandler(options));
  return app;
}

describe("createReadinessHandler", () => {
  it("returns 200 with both checks when database and redis are healthy", async () => {
    const app = buildReadyApp({
      checkDatabase: async () => ({ ok: true, latencyMs: 5 }),
      checkRedis: async () => ({ ok: true, latencyMs: 3 }),
      isShuttingDown: () => false,
    });

    const res = await request(app).get("/ready").expect(200);

    expect(res.body).toEqual({
      success: true,
      checks: {
        database: { ok: true, latencyMs: 5 },
        redis: { ok: true, latencyMs: 3 },
      },
    });
  });

  it("returns 503 when the database check fails", async () => {
    const app = buildReadyApp({
      checkDatabase: async () => ({ ok: false, latencyMs: 1000 }),
      checkRedis: async () => ({ ok: true, latencyMs: 3 }),
      isShuttingDown: () => false,
    });

    const res = await request(app).get("/ready").expect(503);

    expect(res.body.success).toBe(false);
  });

  it("returns 503 when the redis check fails", async () => {
    const app = buildReadyApp({
      checkDatabase: async () => ({ ok: true, latencyMs: 5 }),
      checkRedis: async () => ({ ok: false, latencyMs: 500 }),
      isShuttingDown: () => false,
    });

    const res = await request(app).get("/ready").expect(503);

    expect(res.body.success).toBe(false);
  });

  it("returns 503 when both checks fail", async () => {
    const app = buildReadyApp({
      checkDatabase: async () => ({ ok: false, latencyMs: 1000 }),
      checkRedis: async () => ({ ok: false, latencyMs: 500 }),
      isShuttingDown: () => false,
    });

    const res = await request(app).get("/ready").expect(503);

    expect(res.body.success).toBe(false);
  });

  it("runs the database and redis checks concurrently, not sequentially", async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const app = buildReadyApp({
      checkDatabase: async () => {
        await delay(150);
        return { ok: true, latencyMs: 150 };
      },
      checkRedis: async () => {
        await delay(150);
        return { ok: true, latencyMs: 150 };
      },
      isShuttingDown: () => false,
    });

    const start = Date.now();
    await request(app).get("/ready").expect(200);
    const elapsed = Date.now() - start;

    // Sequential would be >=300ms; concurrent should land close to 150ms.
    // 250ms leaves headroom for CI jitter while still failing a regression
    // to sequential execution.
    expect(elapsed).toBeLessThan(250);
  });

  it("short-circuits to 503 immediately when shutdown state is set, without invoking either check", async () => {
    const checkDatabaseSpy = vi.fn(async () => ({ ok: true, latencyMs: 1 }));
    const checkRedisSpy = vi.fn(async () => ({ ok: true, latencyMs: 1 }));
    const app = buildReadyApp({
      checkDatabase: checkDatabaseSpy,
      checkRedis: checkRedisSpy,
      isShuttingDown: () => true,
    });

    const res = await request(app).get("/ready").expect(503);

    expect(res.body).toEqual({
      success: false,
      checks: {
        database: { ok: false },
        redis: { ok: false },
      },
    });
    expect(checkDatabaseSpy).not.toHaveBeenCalled();
    expect(checkRedisSpy).not.toHaveBeenCalled();
  });
});
