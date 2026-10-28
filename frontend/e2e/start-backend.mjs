// Starts an isolated backend for the Playwright suite (see
// playwright.config.ts). Local/test stack only:
//
//   - its own database, teamos_e2e, dropped and re-migrated on every run;
//   - its own Redis logical database (2; the backend integration tests use 1),
//     flushed on every run;
//   - its own upload directory under the OS temp dir.
//
// Connection settings and secrets come from backend/.env.test and are only
// ever passed on through the environment. The script refuses to touch a
// database that isn't on localhost.

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { E2E_API_PORT, E2E_APP_ORIGIN, E2E_REDIS_DB, loadTestEnv } from "./stack-env.mjs";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
const testEnv = loadTestEnv();

const testDatabaseUrl = new URL(testEnv.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(testDatabaseUrl.hostname)) {
  throw new Error(`Refusing to run e2e against non-local database host ${testDatabaseUrl.hostname}`);
}

const e2eDatabaseUrl = new URL(testDatabaseUrl);
e2eDatabaseUrl.pathname = "/teamos_e2e";
const maintenanceUrl = new URL(testDatabaseUrl);
maintenanceUrl.pathname = "/postgres";

const pgEnv = {
  ...process.env,
  PGHOST: testDatabaseUrl.hostname,
  PGPORT: testDatabaseUrl.port || "5432",
  PGUSER: decodeURIComponent(testDatabaseUrl.username),
  PGPASSWORD: decodeURIComponent(testDatabaseUrl.password),
  PGDATABASE: "postgres",
};

execFileSync(
  "psql",
  ["-v", "ON_ERROR_STOP=1", "-qc", "DROP DATABASE IF EXISTS teamos_e2e WITH (FORCE)", "-c", "CREATE DATABASE teamos_e2e"],
  { env: pgEnv, stdio: "inherit" },
);

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: backendDir,
  env: { ...process.env, DATABASE_URL: e2eDatabaseUrl.toString() },
  stdio: "inherit",
});

execFileSync(
  "redis-cli",
  ["-h", testEnv.REDIS_HOST, "-p", testEnv.REDIS_PORT, "-n", String(E2E_REDIS_DB), "--no-auth-warning", "FLUSHDB"],
  { env: { ...process.env, REDISCLI_AUTH: testEnv.REDIS_PASSWORD }, stdio: "inherit" },
);

const storageRoot = path.join(tmpdir(), "teamos-e2e-uploads");
rmSync(storageRoot, { recursive: true, force: true });
mkdirSync(storageRoot, { recursive: true });

const server = spawn("npx", ["tsx", "src/server.ts"], {
  cwd: backendDir,
  stdio: "inherit",
  env: {
    ...process.env,
    ...testEnv,
    // Verification stays required and email is only enqueued (no worker
    // runs), which is what lets the suite read verification links from the
    // queue instead of a real mailbox.
    NODE_ENV: "test",
    LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? "warn",
    PORT: String(E2E_API_PORT),
    DATABASE_URL: e2eDatabaseUrl.toString(),
    REDIS_DB: String(E2E_REDIS_DB),
    BETTER_AUTH_URL: `http://localhost:${E2E_API_PORT}`,
    FRONTEND_URL: E2E_APP_ORIGIN,
    TRUSTED_ORIGINS: E2E_APP_ORIGIN,
    STORAGE_ROOT: storageRoot,
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
