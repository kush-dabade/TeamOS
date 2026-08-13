const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisPassword = process.env.REDIS_PASSWORD;

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

export const redisConfig = {
  host: redisHost,
  port: parsedPort,
  password: redisPassword,
};