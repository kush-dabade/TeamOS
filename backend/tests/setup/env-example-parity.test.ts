import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "dotenv";

import { EXPECTED_TEST_DATABASE_NAME } from "./reset-database.js";

/**
 * Protects a contract nothing else in this suite covers: that copying
 * backend/.env.test.example to backend/.env.test verbatim - the documented
 * one-time setup step - actually produces a working test environment.
 *
 * CI cannot catch a regression here: .github/workflows/backend-ci.yml
 * supplies RESEND_API_KEY/EMAIL_FROM/etc. directly as workflow env vars, so
 * CI passes regardless of whether .env.test.example itself is correct - this
 * exact gap (EMAIL_FROM/RESEND_API_KEY silently missing from the example
 * while CI stayed green) is what motivated this file.
 *
 * Parses the example file's own on-disk content directly - via dotenv's
 * `parse`, the same function tests/setup/test-env.ts already uses to load
 * the real .env.test - rather than asserting against whatever's already in
 * process.env for this run (which reflects the developer/CI environment
 * that's actually configured, not necessarily what the example file itself
 * would produce for someone following it for the first time).
 */
describe("backend/.env.test.example parity", () => {
  const examplePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.env.test.example",
  );
  const parsed = parse(readFileSync(examplePath, "utf-8"));

  // Every var that throws synchronously, unconditionally (regardless of
  // NODE_ENV), somewhere in the app's module graph that the test process
  // itself imports - see modules/email/email.config.ts, config/redis.config.ts,
  // and lib/auth.ts / queues/email/email.queue.ts. Deliberately does not
  // include TRUSTED_ORIGINS/TRUST_PROXY_HOPS: config/security.config.ts only
  // requires those in production, and Vitest sets NODE_ENV=test, so their
  // absence wouldn't reproduce a real crash the way the vars below would.
  const unconditionallyRequiredVars = [
    "FRONTEND_URL",
    "EMAIL_FROM",
    "RESEND_API_KEY",
    "BETTER_AUTH_SECRET",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_PASSWORD",
  ];

  it.each(unconditionallyRequiredVars)("provides a non-empty %s", (key) => {
    expect(parsed[key]).toBeTruthy();
  });

  it(`points DATABASE_URL at the "${EXPECTED_TEST_DATABASE_NAME}" database reset-database.ts requires`, () => {
    expect(parsed.DATABASE_URL).toBeTruthy();

    const databaseName = new URL(parsed.DATABASE_URL!).pathname.replace(/^\//, "");

    expect(databaseName).toBe(EXPECTED_TEST_DATABASE_NAME);
  });
});
