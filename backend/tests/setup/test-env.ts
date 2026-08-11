import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { config, parse } from "dotenv";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envTestPath = path.join(backendRoot, ".env.test");

// Loads everything else .env.test provides the usual way - non-destructive,
// won't override an already-set value. Fine for TRUSTED_ORIGINS, REDIS_HOST,
// etc., none of which are destructive if stale.
config({ path: envTestPath });

/**
 * DATABASE_URL specifically needs stricter handling than the config() call
 * above: dotenv's own non-override behavior (otherwise correct - it's what
 * lets real deployment secrets win) means if something upstream had already
 * exported DATABASE_URL pointing at the real dev database before this
 * process started, config() would silently keep that value, and every test
 * file's TRUNCATE would then run against it. This reads .env.test's own
 * file content directly (ignoring whatever's already in process.env), with
 * TEST_DATABASE_URL as an explicit, differently-named escape hatch for
 * setups that don't use a .env.test file at all - then force-assigns the
 * result, so a pre-existing process.env.DATABASE_URL can never win here.
 */
function resolveTestDatabaseUrl(): string {
  let fileContents = "";

  try {
    fileContents = readFileSync(envTestPath, "utf-8");
  } catch {
    // .env.test doesn't exist - fall through to the TEST_DATABASE_URL
    // check below rather than failing here, since that's a valid setup too.
  }

  const fromEnvTestFile = parse(fileContents).DATABASE_URL;

  if (fromEnvTestFile) {
    return fromEnvTestFile;
  }

  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  throw new Error(
    "No test database configured. Set DATABASE_URL in backend/.env.test " +
      "(copy backend/.env.test.example) or set TEST_DATABASE_URL explicitly. " +
      "This is deliberately not inherited from an already-set DATABASE_URL, " +
      "to prevent silently resetting the real development database.",
  );
}

process.env.DATABASE_URL = resolveTestDatabaseUrl();
