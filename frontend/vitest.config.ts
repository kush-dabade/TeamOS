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
      // Radix-heavy component tests (Select, DropdownMenu, Sheet) can take
      // several seconds to render under jsdom on slower machines (seen on
      // WSL); the 5s default made them time out intermittently without any
      // assertion failing. Assertions are unchanged.
      testTimeout: 15_000,
      globals: false,
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
