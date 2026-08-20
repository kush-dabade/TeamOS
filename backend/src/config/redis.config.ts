const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD;
// Optional, unlike the three required vars above - defaulting to "0" keeps
// every existing dev/prod deployment's behavior unchanged (ioredis's own
// default logical DB) for anyone who hasn't set this yet. Only backend/.env.test
// sets this to a non-zero value, so test-created BullMQ jobs and rate-limit
// keys land on a logical DB a real dev/prod worker never subscribes to -
// see backend/.env.test.example for the full isolation rationale.
const redisDb = process.env.REDIS_DB ?? "0";

if (!redisHost) {
  throw new Error("REDIS_HOST environment variable is required.");
}

if (!redisPort) {
  throw new Error("REDIS_PORT environment variable is required.");
}

if (!redisPassword) {
  throw new Error("REDIS_PASSWORD environment variable is required.");
}

const parsedPort = Number(redisPort);

if (Number.isNaN(parsedPort)) {
  throw new Error("REDIS_PORT must be a valid number.");
}

const parsedDb = Number(redisDb);

if (!Number.isInteger(parsedDb) || parsedDb < 0) {
  throw new Error("REDIS_DB must be a non-negative integer.");
}

export const redisConfig = {
  host: redisHost,
  port: parsedPort,
  password: redisPassword,
  db: parsedDb,
};