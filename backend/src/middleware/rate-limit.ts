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

// 10/min: each call sends a real outbound email (invitation or resend) to
// an address that isn't necessarily the caller's own - unlike the general
// tier's internal API load, unrestrained volume here has third-party
// blast radius (recipient spam, sender-domain/Resend-account reputation).
// The existing duplicate-pending-invitation check only guards a single
// (workspaceId, email) pair, not distinct addresses or a freshly created
// workspace resetting that scope, so it doesn't substitute for a
// request-frequency limit.
export const invitationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:invitations:"),
  keyGenerator: resolveAuthenticatedUserKey,
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});

// 10/min: avatar uploads carry the same resource cost as attachment
// uploads (disk I/O, storage, bandwidth) - uploadLimiter above only covers
// the task-attachment route, not this separate upload path. The previous
// avatar file is deleted after a successful replace (see
// user.service.ts's uploadAvatar), so this isn't an unbounded-disk-growth
// concern, but repeated churn is still unnecessary I/O the same tier
// already exists to bound elsewhere.
export const avatarLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:avatar:"),
  keyGenerator: resolveAuthenticatedUserKey,
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});

// 3/min per IP - matches Better Auth's own built-in default rule for this
// exact path (getDefaultSpecialRules() in the installed better-auth
// package), not an arbitrarily chosen number. Better Auth ships that rule
// specifically because this endpoint is callable without a session (an
// unverified user has none) and triggers a real outbound email - but its
// built-in limiter's IP resolution only reads the x-forwarded-for header
// (better-auth/dist/utils/get-request-ip.mjs) and nothing in this
// deployment sets it (no reverse proxy in front of the API), so despite
// being "enabled" whenever NODE_ENV=production, it silently never rate
// limits anything here - confirmed via Better Auth's own "Rate limiting
// skipped: could not determine client IP address" log warning, reproduced
// against the real running stack. This uses the same Redis-backed
// mechanism as the limiters above instead, keyed off Express's own req.ip
// (already trust-proxy-aware via app.set("trust proxy", ...) in app.ts),
// so it doesn't depend on that same header.
export const verificationEmailLimiter = rateLimit({
  windowMs: 60_000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:verify-email:"),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});

// 20/min per IP - the IP-scoped half of login abuse protection: caps
// credential-stuffing/scanning volume from a single source regardless of
// which account(s) it targets. Deliberately generous (a shared
// office/NAT/VPN IP genuinely produces bursts of real sign-in traffic) -
// the tight per-account brute-force bound lives separately, keyed by
// normalized email inside Better Auth's own hooks.before (see
// lib/auth.ts), because Express middleware mounted ahead of the Better
// Auth catch-all runs before any body is parsed and has no email to key
// on yet. This limiter only needs the IP, so it has no such constraint.
export const signInIpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:auth:signin:ip:"),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});

// 10/min per IP - bounds mass account-creation/registration spam from a
// single source. Matches the existing upload/invitation/avatar tier
// (rather than verificationEmailLimiter's tighter 3/min) since sign-up is
// the primary, expected-frequency path for creating an account - the
// already-rate-limited resend/verification-email endpoint is the tighter
// one, precisely because sign-up itself only sends one email per attempt
// and legitimate multi-user-per-IP sign-up bursts (a team onboarding
// together from one office) need more headroom.
export const signUpIpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:auth:signup:ip:"),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: handleRateLimitExceeded,
  ...FAIL_OPEN_ON_STORE_ERROR,
});
