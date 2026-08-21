import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores(["dist", "src/generated/prisma", "node_modules", "uploads"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Scoped to application code only (src/), not tests/ - standalone
  // subprocess check scripts under tests/setup/ (e.g.
  // hsts-production-check.ts) legitimately use console.error as a
  // last-resort crash reporter outside the app's logger, and this rule
  // deliberately leaves that use untouched rather than requiring
  // eslint-disable comments for it.
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
]);
