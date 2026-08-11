import type { NextFunction, Request, Response } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import RedisStore, { type RedisReply } from "rate-limit-redis";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";
import { rateLimitRedis } from "../lib/redis.js";
import { RateLimitError } from "../shared/errors/rate-limit-error.js";

// express-rate-limit validates that a single Store instance is never reused
// across multiple rateLimit() calls (ERR_ERL_USE_MULTIPLE_STORE_ONLY_ONCE),
// so each limiter below gets its own RedisStore - all three still share the
// one dedicated `rateLimitRedis` connection (see lib/redis.ts), just
// namespaced with a distinct key prefix.
function createRedisStore(prefix: string): RedisStore {
  return new RedisStore({
    prefix,
    sendCommand: (command, ...args) =>
      rateLimitRedis.call(command, ...args) as Promise<RedisReply>,
  });
}

// Converts an exceeded limit into the same typed-error path every other
// TeamOS error goes through, instead of express-rate-limit's own default
// response - errorHandler.ts's RateLimitError branch produces the standard
// { success: false, error: { code, message } } envelope and a Retry-After
// header computed from the store's own reset time.
function handleRateLimitExceeded(req: Request, _res: Response, next: NextFunction): void {
  // express-rate-limit's Request augmentation (req.rateLimit) isn't merged
  // into Express's own Request type via declaration merging in v8 - it
  // exports a separate AugmentedRequest type instead, which is narrower
  // than the plain Request this handler's signature must accept. A small,
  // precise local cast for just the one field this needs is simpler than
  // fighting that mismatch.
  const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
  const retryAfterSeconds = resetTime
    ? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : undefined;

  next(new RateLimitError("Too many requests. Please try again later.", retryAfterSeconds));
}

// requireAuth is applied per-route (not globally in app.ts - see
// middleware/require-auth.ts and every *.routes.ts file), so there is no
// single point after which req.user is guaranteed set for all of
// /api/v1/*. This general limiter is mounted globally, ahead of route-level
// requireAuth, so it resolves the session itself for keying purposes only
// (not authorization) - the same auth.api.getSession() call requireAuth
// makes. This is a second session lookup on an authenticated request.
// Restructuring auth into a single global middleware to avoid it would
// touch all 55+ existing route declarations across 19 files and change an
// established pattern well beyond this commit's scope - the lookup itself
// is a fast cookie/DB check, not a meaningful cost.
async function resolveGeneralLimiterKey(req: Request): Promise<string> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (session) {
    // Deliberately userId only - never combined with workspaceId or any
    // route param, so switching which workspace a user is acting on can't
    // reset or split their bucket.
    return `user:${session.user.id}`;
  }

  // ipKeyGenerator (not raw req.ip) is required here, not just safer:
  // express-rate-limit's own validation throws ERR_ERL_KEY_GEN_IPV6 at
  // startup if a custom keyGenerator references req.ip without it, since a
  // raw IPv6 address would let a client rotate within their own /64 subnet
  // to bypass the limit. req.ip itself already reflects Commit #1's
  // app.set("trust proxy", trustProxyHops) - no separate IP logic needed.
  return ipKeyGenerator(req.ip ?? "unknown");
}

// Runs after requireAuth on the routes that use it (search, uploads), so
// req.user is already guaranteed set - no session lookup needed here.
function resolveAuthenticatedUserKey(req: Request): string {
  return `user:${req.user!.id}`;
}

// Redis is an availability/security optimization here, not a hard
// dependency - express-rate-limit's own default (passOnStoreError: false)
// rejects the request when the store errors, which would turn a Redis
// outage into a 500 for the entire /api/v1 surface on top of the ~10s a
// command can otherwise take to fail (see commandTimeout in lib/redis.ts).
// Explicitly failing open here means a Redis problem degrades to
// "temporarily not rate-limited," not "API unavailable."
const FAIL_OPEN_ON_STORE_ERROR = { passOnStoreError: true } as const;

// 300/min: routine CRUD across workspaces/tasks/projects/comments etc.
// Generous enough that an active UI session (several parallel fetches on
// dashboard load) never gets close, while bounding runaway client bugs or
// scripted abuse.
export const generalApiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:general:"),
  keyGenerator: resolveGeneralLimiterKey,
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});

// 20/min: full-text search is the most DB-expensive read path in the API
// (uses the trigram-style indexes from the add-search-indexes migration) -
// a classic "search bombing" target. Comfortably covers real interactive
// typing while capping the expensive path tightly.
export const searchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:search:"),
  keyGenerator: resolveAuthenticatedUserKey,
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});

// 10/min: uploads carry real resource cost (disk I/O, storage, bandwidth)
// and legitimate usage is bursty-but-infrequent, not continuous. This
// bounds request frequency; multer's own LIMIT_FILE_SIZE handling (see
// error-handler.ts) is a separate, unrelated concern.
export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:upload:"),
  keyGenerator: resolveAuthenticatedUserKey,
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});
