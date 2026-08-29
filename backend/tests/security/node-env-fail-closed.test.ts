import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NODE_ENV_CHECK_SCRIPT = path.join(backendRoot, "tests/setup/node-env-security-check.ts");

async function runCheck(
  nodeEnv: string | undefined,
): Promise<{ isProduction: boolean; isLocalDevelopment: boolean }> {
  // Deletes the key entirely for the "unset" case, rather than setting it to
  // "" - an empty string is a different (and already-safe) value from a
  // genuinely absent NODE_ENV, and child_process env values must be actual
  // strings, so `NODE_ENV: undefined` can't be used to represent "unset"
  // here.
  const env = { ...process.env };

  if (nodeEnv === undefined) {
    delete env.NODE_ENV;
  } else {
    env.NODE_ENV = nodeEnv;
  }

  const { stdout } = await execFileAsync("npx", ["tsx", NODE_ENV_CHECK_SCRIPT], {
    cwd: backendRoot,
    env,
  });

  return JSON.parse(stdout) as { isProduction: boolean; isLocalDevelopment: boolean };
}

/**
 * config/security.config.ts's isLocalDevelopment gates real security-relevant
 * behavior - lib/auth.ts's development-only email-verification bypass, and
 * prisma/seed.ts's seed guard - so it must fail closed on every NODE_ENV
 * value except the one explicit opt-in ("development"), including NODE_ENV
 * being entirely unset (a misconfigured deployment forgetting to set it).
 * Before this fix, `process.env.NODE_ENV ?? "development"` meant an unset
 * NODE_ENV silently behaved exactly like "development" - the most
 * permissive case, not the safest one.
 */
describe("NODE_ENV fail-closed behavior (config/security.config.ts)", () => {
  it("enables isLocalDevelopment under the explicit opt-in, NODE_ENV=development", async () => {
    const result = await runCheck("development");

    expect(result.isLocalDevelopment).toBe(true);
    expect(result.isProduction).toBe(false);
  });

  it("disables isLocalDevelopment under NODE_ENV=test", async () => {
    const result = await runCheck("test");

    expect(result.isLocalDevelopment).toBe(false);
    expect(result.isProduction).toBe(false);
  });

  it("disables isLocalDevelopment under NODE_ENV=production, and enables isProduction", async () => {
    const result = await runCheck("production");

    expect(result.isLocalDevelopment).toBe(false);
    expect(result.isProduction).toBe(true);
  });

  it("disables isLocalDevelopment when NODE_ENV is entirely unset - the fail-closed fix", async () => {
    const result = await runCheck(undefined);

    expect(result.isLocalDevelopment).toBe(false);
    expect(result.isProduction).toBe(false);
  });
});
