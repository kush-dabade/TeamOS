import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { DestinationStream } from "pino";

import { createRequestIdMiddleware } from "../../src/middleware/request-id.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { createLogger } from "../../src/lib/logger.js";

const VALID_HEADER = "abc123_-XYZ";

/**
 * Mirrors logger.test.ts's own createMemoryStream - collects each NDJSON
 * record a test-only logger instance writes, so assertions can inspect
 * real emitted log records instead of only the logger's public API. That's
 * what makes this a correlation test rather than a "req.log exists" test:
 * it proves the requestId returned in the X-Request-Id header is the same
 * value that actually lands in the emitted log record.
 */
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

/**
 * A minimal app, independent of src/app.ts's full route/middleware stack -
 * this suite is about request-id.ts and error-handler.ts's correlation
 * behavior specifically, not an end-to-end app boot (security-headers.test.ts
 * and the rest of tests/security already cover the full app).
 */
function buildTestApp(stream: DestinationStream) {
  const testLogger = createLogger({ stream, level: "info" });
  const app = express();

  app.use(createRequestIdMiddleware({ logger: testLogger }));

  app.get("/ping", (req, res) => {
    req.log.info("handled ping");
    res.status(200).json({ requestId: req.id });
  });

  app.get("/boom", () => {
    throw new Error("boom");
  });

  app.use(errorHandler);

  return app;
}

describe("request-id middleware", () => {
  it("generates a request ID, returns it in X-Request-Id, and the same ID lands in the correlated log record", async () => {
    const stream = createMemoryStream();
    const app = buildTestApp(stream);

    const res = await request(app).get("/ping").expect(200);

    const headerId = res.headers["x-request-id"];
    expect(headerId).toBeTruthy();
    expect(res.body.requestId).toBe(headerId);

    const record = stream.records().find((r) => r.msg === "handled ping");
    expect(record?.requestId).toBe(headerId);
  });

  it("preserves a valid client-supplied X-Request-Id into the response header and the correlated log record", async () => {
    const stream = createMemoryStream();
    const app = buildTestApp(stream);

    const res = await request(app).get("/ping").set("X-Request-Id", VALID_HEADER).expect(200);

    expect(res.headers["x-request-id"]).toBe(VALID_HEADER);
    expect(res.body.requestId).toBe(VALID_HEADER);

    const record = stream.records().find((r) => r.msg === "handled ping");
    expect(record?.requestId).toBe(VALID_HEADER);
  });

  it("replaces an invalid client-supplied X-Request-Id with a generated one, and returns the generated ID", async () => {
    const stream = createMemoryStream();
    const app = buildTestApp(stream);

    const res = await request(app)
      .get("/ping")
      .set("X-Request-Id", "not valid! has spaces and punctuation")
      .expect(200);

    const headerId = res.headers["x-request-id"];
    expect(headerId).toBeTruthy();
    expect(headerId).not.toBe("not valid! has spaces and punctuation");
    expect(res.body.requestId).toBe(headerId);
  });

  it("replaces an over-length client-supplied X-Request-Id (>100 chars) with a generated one", async () => {
    const stream = createMemoryStream();
    const app = buildTestApp(stream);
    const tooLong = "a".repeat(101);

    const res = await request(app).get("/ping").set("X-Request-Id", tooLong).expect(200);

    const headerId = res.headers["x-request-id"];
    expect(headerId).toBeTruthy();
    expect(headerId).not.toBe(tooLong);
  });

  it("generates a request ID when no header is supplied at all (missing case)", async () => {
    const stream = createMemoryStream();
    const app = buildTestApp(stream);

    const res = await request(app).get("/ping").expect(200);

    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("sets X-Request-Id on an error response, and errorHandler's log record carries the same requestId", async () => {
    const stream = createMemoryStream();
    const app = buildTestApp(stream);

    const res = await request(app).get("/boom").expect(500);

    const headerId = res.headers["x-request-id"];
    expect(headerId).toBeTruthy();

    // Envelope must stay exactly {success, error: {code, message}} - no
    // requestId in the response body for this commit.
    expect(res.body).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An internal error occurred" },
    });

    const record = stream.records().find((r) => r.msg === "Unhandled error");
    expect(record?.requestId).toBe(headerId);
    expect((record?.err as { message?: string } | undefined)?.message).toBe("boom");
  });
});
