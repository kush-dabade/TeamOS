import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./setup/test-env.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Runs once, in Vitest's main process, before any test file/worker starts.
// Solely responsible for the one-time migration - env loading/validation
// is entirely delegated to tests/setup/test-env.ts's side effect (imported
// above), the same module vitest.config.ts's setupFiles loads inside each
// worker, so there is exactly one place that knows how to load .env.test.
export default function setup(): void {
  // Applies existing migrations to whatever DATABASE_URL points at - reads
  // the same prisma/schema.prisma and prisma.config.ts the app itself
  // uses, so this only ever targets .env.test's database, never the real
  // one, as long as .env.test's DATABASE_URL differs from .env's.
  execSync("npx prisma migrate deploy", {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env,
  });
}
