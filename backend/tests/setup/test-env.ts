import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Side-effect-only module: loading it (via plain `import` or Vitest's
// setupFiles) loads backend/.env.test into process.env and validates it.
// dotenv does not override a variable that's already set, so this only
// ever fills in what the environment doesn't already provide.
//
// Reused as-is by both tests/global-setup.ts (runs once, in Vitest's main
// process, before migrate deploy) and vitest.config.ts's setupFiles (runs
// inside every test worker, before that worker's test files import the
// app) - globalSetup's own process.env mutations are not reliably
// inherited by workers, so both need to load it independently rather than
// relying on one or the other.
config({ path: path.join(backendRoot, ".env.test") });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy backend/.env.test.example to backend/.env.test, " +
      "point it at a disposable database (not your real dev database), and re-run.",
  );
}
