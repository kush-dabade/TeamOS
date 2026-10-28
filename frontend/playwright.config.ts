import { defineConfig, devices } from "@playwright/test";

import { E2E_API_ORIGIN, E2E_APP_ORIGIN, E2E_APP_PORT } from "./e2e/stack-env.mjs";

// End-to-end suite against a local stack only - a dedicated database,
// Redis DB and upload directory, started fresh for every run by
// e2e/start-backend.mjs. Never point it at production.
//
// Prerequisites: local Postgres and Redis matching backend/.env.test
// (see docs/development/testing.md), and `npx playwright install chromium`.
export default defineConfig({
  testDir: "./e2e",
  // Shared rate limits (sign-up/sign-in per IP) and one database: run specs
  // one at a time, in a stable order.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_APP_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/start-backend.mjs",
      url: `${E2E_API_ORIGIN}/ready`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // A production build, as deployed - and no dev-server HMR or dependency
      // re-optimisation reloads wiping a page mid-test.
      command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${E2E_APP_PORT} --strictPort`,
      url: E2E_APP_ORIGIN,
      timeout: 300_000,
      reuseExistingServer: false,
      env: { VITE_API_URL: E2E_API_ORIGIN },
    },
  ],
});
