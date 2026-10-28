import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

// Extends the app's own Vite config (React plugin, Tailwind plugin, the
// @/* alias via resolve.tsconfigPaths) instead of re-declaring it here, so
// tests resolve imports exactly like the app does.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Unit/component tests only; e2e/*.spec.ts are Playwright's (see
      // playwright.config.ts) and need a running stack.
      include: ["src/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
