import { Redis } from "ioredis";

import { redisConfig } from "../config/redis.config.js";

export const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
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
  commandTimeout: 500,
});

// Without a listener, a connection error here prints Node's generic
// "Unhandled error event" warning (full stack trace) instead of one
// intentional line - this is the one place that failure should be visible
// in logs, not silent.
rateLimitRedis.on("error", (error) => {
  console.error("Rate-limit Redis connection error:", error.message);
});
