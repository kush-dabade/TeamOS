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
// path of every /api/v1 request; sharing the BullMQ-tuned client would mean
// a Redis outage makes every request hang indefinitely (queued forever)
// instead of failing fast, which could take down the whole API rather than
// just degrading rate limiting. Same connection config, isolated failure
// behavior - not a new abstraction, just a second instance of the same
// client type.
export const rateLimitRedis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
});
