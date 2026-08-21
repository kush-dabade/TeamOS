import crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";

import { logger as defaultLogger } from "../lib/logger.js";

// Deliberately restrictive: header-injection-safe (no newlines/control
// characters can smuggle through into a log line or downstream header), and
// generous enough for a client-generated UUID, ULID, or similar correlation
// ID a caller might already be using upstream (e.g. an API gateway).
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export interface RequestIdMiddlewareOptions {
  /**
   * Defaults to the app-wide `logger` singleton. Overridable so tests can
   * inject a logger writing to an inspectable stream (see logger.test.ts's
   * `createMemoryStream`) instead of asserting against the real one, which
   * would either scrape stdout or leak into every other test's log output.
   */
  logger?: Logger;
}

/**
 * Mounted first in app.ts, ahead of even securityHeaders - res.setHeader
 * calls persist on the response regardless of what happens afterward, so
 * running before every other middleware is what guarantees X-Request-Id is
 * present on every response this app sends, including the earliest possible
 * failures.
 *
 * A caller-supplied X-Request-Id is honored only when it matches
 * REQUEST_ID_PATTERN; anything missing or invalid is replaced with a
 * server-generated one rather than rejected outright - a malformed
 * correlation ID from an upstream proxy shouldn't be able to fail a
 * request, only lose its correlation value.
 */
export function createRequestIdMiddleware({
  logger = defaultLogger,
}: RequestIdMiddlewareOptions = {}) {
  return function requestId(req: Request, res: Response, next: NextFunction): void {
    const suppliedId = req.header("X-Request-Id");
    const id =
      suppliedId && REQUEST_ID_PATTERN.test(suppliedId) ? suppliedId : crypto.randomUUID();

    req.id = id;
    req.log = logger.child({ requestId: id });
    res.setHeader("X-Request-Id", id);

    next();
  };
}
