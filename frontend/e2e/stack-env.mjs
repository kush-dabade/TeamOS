// Shared settings for the local e2e stack (start-backend.mjs, the Playwright
// config and the specs' helpers).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_API_PORT = 3100;
export const E2E_APP_PORT = 5174;
export const E2E_APP_ORIGIN = `http://localhost:${E2E_APP_PORT}`;
export const E2E_API_ORIGIN = `http://localhost:${E2E_API_PORT}`;
export const E2E_REDIS_DB = 2;

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "EMAIL_FROM",
  "RESEND_API_KEY",
];

/**
 * backend/.env.test as an object. The backend's integration-test settings
 * (local Postgres and Redis) are the e2e stack's base; values are never
 * logged.
 */
export function loadTestEnv() {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend/.env.test");
  const values = {};

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }

  const missing = REQUIRED_KEYS.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(`backend/.env.test is missing: ${missing.join(", ")}`);
  }

  return values;
}
