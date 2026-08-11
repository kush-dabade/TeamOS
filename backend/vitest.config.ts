import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    globalSetup: ["./tests/global-setup.ts"],
    // Loads .env.test inside each worker - globalSetup's own process.env
    // mutations run in a separate process and are not reliably inherited
    // by test workers, so this can't be skipped in favor of globalSetup.
    setupFiles: ["./tests/setup/test-env.ts"],
    // All test files share one teamos_test database with TRUNCATE-based
    // cleanup (see tests/setup/reset-database.ts) - running files in
    // parallel would let them race and clobber each other's state.
    fileParallelism: false,
    // Real HTTP/Socket.IO/Postgres round trips, not pure unit tests - the
    // 5s default is tight for that.
    testTimeout: 15000,
  },
});
