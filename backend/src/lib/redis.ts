import { Redis } from "ioredis";

import { redisConfig } from "../config/redis.config.js";

export const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  maxRetriesPerRequest: null,
});