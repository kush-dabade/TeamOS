import { Redis } from "ioredis";

import { redisConfig } from "../config/redis.config.js";
import { logger } from "./logger.js";

export const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  maxRetriesPerRequest: null,
});

// Separate connection for rate limiting, deliberately without the
// maxRetriesPerRequest: null tuning above - that setting is a BullMQ
// requirement (its blocking commands need queued commands to retry
// indefinitely rather than erroring out). Rate-limit checks run on the hot
// path of every /api/v1 request, so this connection needs its own failure
// behavior, isolated from BullMQ's - not a new abstraction, just a second
// instance of the same client type.
//
// commandTimeout bounds every command to this connection at a hard ceiling,
// independent of connection/retry state (verified against ioredis's source:
// the timer starts the instant a command is issued, before any queueing or
// reconnect logic runs) - without it, ioredis's default retry behavior
// (maxRetriesPerRequest: 20, capped backoff) can take ~10s to fail a single
// command during a Redis outage, and middleware/rate-limit.ts's
// passOnStoreError only helps once the command actually fails. 500ms is
// generous for a co-located Docker Compose Redis under normal load, while
// still cutting a real outage down from ~10s to sub-second per request.
export const rateLimitRedis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  commandTimeout: 500,
});

// Without a listener, a connection error here prints Node's generic
// "Unhandled error event" warning (full stack trace) instead of one
// intentional line - this is the one place that failure should be visible
// in logs, not silent.
rateLimitRedis.on("error", (error) => {
  // Degraded, not fatal - every consumer of rateLimitRedis (rate-limit.ts's
  // limiters, auth.ts's sign-in account limiter) fails open on a Redis
  // error, so this connection being unhealthy means "temporarily
  // unprotected," not "the app is broken."
  logger.warn({ err: error }, "Rate-limit Redis connection error");
});

// Atomic INCR-then-conditionally-set-TTL, expressed as a single Lua script
// so Redis (single-threaded per script) executes both steps as one
// indivisible operation - two concurrent callers can never both observe
// count === 1 and both (re)set the TTL, and a caller arriving after the
// window has already been established can never accidentally extend it,
// since PEXPIRE only runs on the increment that produces count === 1.
// Mirrors the same contract rate-limit-redis's own Lua script already
// gives every express-rate-limit-based limiter in middleware/rate-limit.ts
// (see tests/setup/reset-rate-limits.ts's comment: "SET key 1 PX windowMs
// on first hit and INCR thereafter") - this is a small hand-rolled
// equivalent for the one limiter that isn't Express middleware (it's
// called from inside a Better Auth hook, not a request/response cycle
// express-rate-limit can wrap) and so can't reuse that library directly.
const INCREMENT_WITH_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`;

/**
 * Atomically increments `key` on the rate-limit Redis connection, setting a
 * `windowMs` expiry only on the increment that first creates the key. Returns
 * the counter's new value after this increment - callers compare it against
 * their own limit rather than this function enforcing one, since "count vs.
 * limit" and "what to do once exceeded" are caller-specific decisions.
 */
export async function incrementRateLimitCounter(key: string, windowMs: number): Promise<number> {
  const count = await rateLimitRedis.eval(INCREMENT_WITH_WINDOW_SCRIPT, 1, key, windowMs);

  return count as number;
}
