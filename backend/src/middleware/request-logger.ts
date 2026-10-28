import type { NextFunction, Request, Response } from "express";

const MAX_LOGGED_PATH_LENGTH = 200;

// Healthy probes run every few seconds (Docker healthchecks, uptime checks)
// and would drown out real traffic; a failing probe is still logged.
const PROBE_PATHS = new Set(["/health", "/ready"]);

// Route literals in this API are lowercase words joined by hyphens
// ("transfer-ownership", "unread-count"). A long segment containing
// anything else - digits, capitals, underscores - is an id or a token
// (cuid ids, Better Auth user ids, invitation and password-reset tokens) and
// must not reach the logs verbatim.
const OPAQUE_SEGMENT_MIN_LENGTH = 16;
const LITERAL_SEGMENT = /^[a-z-]+$/;

/**
 * The request path with ids and tokens replaced by ":id". The query string
 * is dropped entirely: it can carry tokens (e.g. Better Auth's
 * /verify-email?token=...) and search terms.
 */
export function normalizeRequestPath(originalUrl: string): string {
  const [path = "/"] = originalUrl.split("?");

  const normalized = path
    .split("/")
    .map((segment) =>
      segment.length >= OPAQUE_SEGMENT_MIN_LENGTH && !LITERAL_SEGMENT.test(segment)
        ? ":id"
        : segment,
    )
    .join("/");

  return normalized.length > MAX_LOGGED_PATH_LENGTH
    ? `${normalized.slice(0, MAX_LOGGED_PATH_LENGTH)}...`
    : normalized;
}

/**
 * One structured access-log line per request, written through req.log so
 * it carries the request id from createRequestIdMiddleware (which must be
 * mounted first). Deliberately logs no headers, cookies, query strings,
 * bodies, or client IPs.
 */
export function createRequestLoggerMiddleware() {
  return function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    let logged = false;

    const log = (aborted: boolean) => {
      if (logged) {
        return;
      }
      logged = true;

      const path = normalizeRequestPath(req.originalUrl);
      const statusCode = res.statusCode;

      if (!aborted && statusCode < 400 && PROBE_PATHS.has(path)) {
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const errorCode = res.locals.errorCode as string | undefined;

      const fields = {
        method: req.method,
        path,
        statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        ...(errorCode !== undefined && { errorCode }),
        ...(req.user?.id !== undefined && { userId: req.user.id }),
        ...(aborted && { aborted: true }),
      };

      if (statusCode >= 500) {
        req.log.error(fields, "Request failed");
      } else if (statusCode >= 400 || aborted) {
        req.log.warn(fields, "Request completed with client error");
      } else {
        req.log.info(fields, "Request completed");
      }
    };

    res.on("finish", () => log(false));
    res.on("close", () => {
      if (!res.writableFinished) {
        log(true);
      }
    });

    next();
  };
}
