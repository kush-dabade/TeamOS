import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EMAIL_CONFIG_BOOT_CHECK_SCRIPT = path.join(
  backendRoot,
  "tests/setup/email-config-boot-check.ts",
);

interface BootCheckResult {
  imported: boolean;
  enabled?: boolean;
  resendIsNull?: boolean;
  error?: string;
}

async function runBootCheck(options: {
  nodeEnv: string;
  withCredentials: boolean;
}): Promise<BootCheckResult> {
  // Explicit NodeJS.ProcessEnv annotation, not left to inference: spreading
  // process.env (which has a `[key: string]: string | undefined` index
  // signature) alongside an explicit property narrows the *inferred* object
  // literal type down to just that one explicit property, silently dropping
  // the index signature - so without this annotation, `env.EMAIL_FROM`
  // below doesn't type-check even though it's valid at runtime. Verified via
  // a minimal repro: `{ ...processEnv, X: "x" }` infers as `{ X: string }`;
  // `{ ...processEnv }` alone does not have this problem, which is why the
  // sibling node-env-fail-closed.test.ts (no extra property in its spread)
  // never hit this.
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: options.nodeEnv };

  if (!options.withCredentials) {
    // Deleted, not set to "" - email.config.ts treats an empty string the
    // same as absent (Boolean(emailFrom && resendApiKey)), but deleting
    // matches what a genuinely blank backend/.env.example value produces
    // once dotenv parses it (undefined, not "").
    delete env.EMAIL_FROM;
    delete env.RESEND_API_KEY;
  }

  const { stdout } = await execFileAsync("npx", ["tsx", EMAIL_CONFIG_BOOT_CHECK_SCRIPT], {
    cwd: backendRoot,
    env,
  });

  return JSON.parse(stdout) as BootCheckResult;
}

/**
 * The local worker/no-Resend fix: modules/email/email.config.ts and
 * modules/email/email.client.ts. Before this fix, importing this module
 * graph without EMAIL_FROM/RESEND_API_KEY set threw synchronously in every
 * environment, crashing the worker process at startup - reproduced by the
 * "without credentials" cases below still throwing in test/production, and
 * NOT throwing only in development (isLocalDevelopment, the same boundary
 * Commit 3's email-verification bypass and prisma/seed.ts's seed guard use).
 */
describe("local worker boots without Resend credentials (config/email.config.ts)", () => {
  it("does not throw, and disables sending, under NODE_ENV=development without credentials", async () => {
    const result = await runBootCheck({ nodeEnv: "development", withCredentials: false });

    expect(result.imported).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.resendIsNull).toBe(true);
  });

  it("still throws under NODE_ENV=test without credentials - test must keep failing fast, same as production", async () => {
    const result = await runBootCheck({ nodeEnv: "test", withCredentials: false });

    expect(result.imported).toBe(false);
    expect(result.error).toMatch(/EMAIL_FROM and RESEND_API_KEY/);
  });

  it("still throws under NODE_ENV=production without credentials - production must never silently disable email", async () => {
    const result = await runBootCheck({ nodeEnv: "production", withCredentials: false });

    expect(result.imported).toBe(false);
    expect(result.error).toMatch(/EMAIL_FROM and RESEND_API_KEY/);
  });

  it("imports successfully and enables sending under NODE_ENV=production with real credentials configured", async () => {
    const result = await runBootCheck({ nodeEnv: "production", withCredentials: true });

    expect(result.imported).toBe(true);
    expect(result.enabled).toBe(true);
    expect(result.resendIsNull).toBe(false);
  });
});
