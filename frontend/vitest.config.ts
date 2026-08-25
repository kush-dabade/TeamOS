import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

// Extends the app's own Vite config (React plugin, Tailwind plugin, the
// @/* alias via resolve.tsconfigPaths) instead of re-declaring it here, so
// tests resolve imports exactly like the app does.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
