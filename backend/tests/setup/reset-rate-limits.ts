import { rateLimitRedis } from "../../src/lib/redis.js";

/**
 * Clears only the rate-limit counters this app writes (every key under the
 * "rl:" prefix - see middleware/rate-limit.ts's three RedisStore prefixes:
 * rl:general:, rl:search:, rl:upload:). Deliberately NOT a FLUSHALL - this
 * Redis instance is shared with BullMQ (see lib/redis.ts), and a blanket
 * flush would wipe unrelated queue state. SCAN+DEL, not KEYS+DEL, even
 * though the test dataset is tiny - no reason to reach for the
 * production-discouraged command when the safe one is just as simple.
 */
export async function resetRateLimitState(): Promise<void> {
  let cursor = "0";
  const keys: string[] = [];

  do {
    const [nextCursor, batch] = await rateLimitRedis.scan(
      cursor,
      "MATCH",
      "rl:*",
      "COUNT",
      "100",
    );
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  if (keys.length > 0) {
    await rateLimitRedis.del(...keys);
  }
}

/**
 * Pre-seeds a rate-limit counter directly in Redis, using the exact key
 * format RedisStore itself produces (`${prefix}${key}`, a plain string
 * counter with a millisecond-window TTL - see rate-limit-redis's
 * increment.lua, which does SET key 1 PX windowMs on first hit and INCR
 * thereafter). Lets a test reach the configured boundary with two real HTTP
 * requests instead of sending hundreds of throwaway ones: the two requests
 * that actually run still go through the real middleware, the real Redis
 * Lua script, and the real 429 handling - only the setup is fast-forwarded,
 * the same "direct data insert, real code path for the assertion"
 * philosophy fixtures.ts already uses for Postgres.
 *
 * `key` must match what the limiter's own keyGenerator would produce for
 * the identity under test - e.g. `user:<id>` for an authenticated request
 * (see resolveGeneralLimiterKey/resolveAuthenticatedUserKey in
 * middleware/rate-limit.ts).
 */
export async function seedRateLimitCount(
  prefix: string,
  key: string,
  count: number,
  windowMs = 60_000,
): Promise<void> {
  await rateLimitRedis.set(`${prefix}${key}`, count, "PX", windowMs);
}
