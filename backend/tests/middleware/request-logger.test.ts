import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { DestinationStream } from "pino";

import { createLogger } from "../../src/lib/logger.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { createRequestIdMiddleware } from "../../src/middleware/request-id.js";
import {
  createRequestLoggerMiddleware,
  normalizeRequestPath,
} from "../../src/middleware/request-logger.js";
import { NotFoundError } from "../../src/shared/errors/not-found-error.js";

// Same in-memory NDJSON sink as request-id.test.ts.
function createMemoryStream(): DestinationStream & { records: () => Record<string, unknown>[] } {
  let buffer = "";

  return {
    write(chunk: string) {
      buffer += chunk;
    },
    records() {
      return buffer
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  };
}

const RESET_TOKEN = "Zx81kQ_secretResetToken_9fA2";
const TASK_ID = "cmvrsyfoy00ad08lmwewx0768";

function buildApp() {
  const stream = createMemoryStream();
  const logger = createLogger({ stream, level: "info" });
  const app = express();

  app.use(createRequestIdMiddleware({ logger }));
  app.use(createRequestLoggerMiddleware());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/ready", (_req, res) => {
    res.status(503).json({ ok: false });
  });
  app.get("/api/auth/reset-password/:token", (_req, res) => {
    res.redirect(302, "/reset-password");
  });
  app.post("/api/auth/sign-in/email", (_req, res) => {
    res.status(401).json({ code: "INVALID_EMAIL_OR_PASSWORD" });
  });
  app.get("/api/v1/tasks/:taskId", (req, _res, next) => {
    req.user = { id: "user-42", email: "ada@example.com", name: "Ada" };
    next(new NotFoundError("Task not found"));
  });
  app.get("/api/v1/boom", () => {
    throw new Error("database exploded");
  });
  app.use(errorHandler);

  // Pino writes asynchronously relative to supertest's resolution only in
  // the sense that "finish" fires after the body is flushed; give the
  // listener a tick before reading the sink.
  const records = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    return stream.records();
  };

  return { app, records };
}

describe("normalizeRequestPath", () => {
  it("replaces ids and tokens and drops the query string", () => {
    expect(normalizeRequestPath(`/api/v1/tasks/${TASK_ID}/comments?page=2`)).toBe(
      "/api/v1/tasks/:id/comments",
    );
    expect(normalizeRequestPath(`/api/auth/reset-password/${RESET_TOKEN}?callbackURL=x`)).toBe(
      "/api/auth/reset-password/:id",
    );
    expect(normalizeRequestPath("/api/auth/verify-email?token=abc.def.ghi")).toBe(
      "/api/auth/verify-email",
    );
  });

  it("keeps hyphenated route literals", () => {
    expect(normalizeRequestPath("/api/v1/projects/p1/transfer-ownership")).toBe(
      "/api/v1/projects/p1/transfer-ownership",
    );
    expect(normalizeRequestPath("/api/v1/notifications/unread-count")).toBe(
      "/api/v1/notifications/unread-count",
    );
  });

  it("caps attacker-controlled path length", () => {
    expect(normalizeRequestPath(`/${"a".repeat(500)}`).length).toBeLessThanOrEqual(203);
  });
});

describe("request logger", () => {
  it("logs one line per request with id, normalized path, status and latency", async () => {
    const { app, records } = buildApp();

    const response = await request(app).get(`/api/v1/tasks/${TASK_ID}?q=private`);
    const lines = (await records()).filter((record) => record.path !== undefined);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "warn",
      requestId: response.headers["x-request-id"],
      method: "GET",
      path: "/api/v1/tasks/:id",
      statusCode: 404,
      errorCode: "NOT_FOUND",
      userId: "user-42",
    });
    expect(typeof lines[0]?.durationMs).toBe("number");
  });

  it("never records credentials, cookies, tokens, query strings or bodies", async () => {
    const { app, records } = buildApp();

    await request(app)
      .post("/api/auth/sign-in/email?redirect=/secret-place")
      .set("Authorization", "Bearer super-secret-bearer")
      .set("Cookie", "better-auth.session_token=session-cookie-value")
      .send({ email: "ada@example.com", password: "Hunter2Hunter2" });
    await request(app).get(`/api/auth/reset-password/${RESET_TOKEN}`);

    const serialized = JSON.stringify(await records());

    for (const secret of [
      "super-secret-bearer",
      "session-cookie-value",
      "Hunter2Hunter2",
      "ada@example.com",
      RESET_TOKEN,
      "secret-place",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("logs server errors at error level", async () => {
    const { app, records } = buildApp();

    await request(app).get("/api/v1/boom");
    const line = (await records()).find((record) => record.path === "/api/v1/boom");

    expect(line).toMatchObject({ level: "error", statusCode: 500, msg: "Request failed" });
  });

  it("skips healthy probes but logs failing ones", async () => {
    const { app, records } = buildApp();

    await request(app).get("/health");
    await request(app).get("/ready");
    const paths = (await records()).map((record) => record.path).filter(Boolean);

    expect(paths).toEqual(["/ready"]);
  });
});
