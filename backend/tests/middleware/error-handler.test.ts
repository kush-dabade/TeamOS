import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../src/middleware/error-handler.js";
import { createRequestIdMiddleware } from "../../src/middleware/request-id.js";

/**
 * Minimal app, independent of src/app.ts's full route/middleware stack -
 * same convention as request-id.test.ts's buildTestApp. This suite is about
 * express.json()'s real body-parser failures reaching the real errorHandler,
 * not an end-to-end app boot - no auth/workspace/DB setup is relevant to
 * whether a malformed/oversized request body is classified correctly, since
 * express.json() (mounted globally ahead of every route, see src/app.ts:100)
 * always runs before any of that.
 *
 * createRequestIdMiddleware is mounted first, matching src/app.ts's own
 * ordering - errorHandler's generic fallback branch calls req.log.error(...),
 * so without this, req.log would be undefined and errorHandler would throw
 * on that branch instead of exercising its actual current behavior.
 */
function buildTestApp() {
  const app = express();

  app.use(createRequestIdMiddleware());
  app.use(express.json());

  app.post("/echo", (req, res) => {
    res.status(200).json({ received: req.body });
  });

  app.use(errorHandler);

  return app;
}

describe("errorHandler - request body parsing failures", () => {
  it("returns 400 VALIDATION_ERROR for malformed JSON, not a generic 500", async () => {
    const app = buildTestApp();

    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send('{"a":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Malformed JSON in request body",
      },
    });
  });

  it("returns 413 PAYLOAD_TOO_LARGE for a request body exceeding the configured limit, not a generic 500", async () => {
    const app = buildTestApp();

    // express.json() defaults to a 100kb limit when none is configured
    // (matching src/app.ts:100's unconfigured `express.json()`) - 110kb of
    // payload is the smallest deterministic amount that reliably exceeds
    // that limit without allocating an unnecessarily large buffer.
    const oversizedValue = "a".repeat(110 * 1024);

    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ value: oversizedValue }));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the maximum allowed size",
      },
    });
  });

  it("still returns the standard 500 INTERNAL_ERROR envelope for an unrelated unhandled error", async () => {
    const app = express();

    app.use(createRequestIdMiddleware());
    app.get("/boom", () => {
      throw new Error("boom");
    });
    app.use(errorHandler);

    const res = await request(app).get("/boom").expect(500);

    expect(res.body).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An internal error occurred" },
    });
  });
});
