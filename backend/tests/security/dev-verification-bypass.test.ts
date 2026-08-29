import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEV_BYPASS_CHECK_SCRIPT = path.join(
  backendRoot,
  "tests/setup/dev-verification-bypass-check.ts",
);

async function runBypassCheck(
  nodeEnv: string,
): Promise<{ emailVerified: boolean; verificationEmailEnqueued: boolean }> {
  const { stdout } = await execFileAsync("npx", ["tsx", DEV_BYPASS_CHECK_SCRIPT], {
    cwd: backendRoot,
    env: { ...process.env, NODE_ENV: nodeEnv },
  });

  return JSON.parse(stdout) as { emailVerified: boolean; verificationEmailEnqueued: boolean };
}

/**
 * Commit 3: databaseHooks.user.create.before, and
 * emailVerification.sendVerificationEmail's development-only enqueue skip
 * (both in lib/auth.ts). Both run as genuinely separate processes - see
 * dev-verification-bypass-check.ts's own comment for why - covering the two
 * NODE_ENV values this feature actually branches on.
 *
 * NODE_ENV=test (this suite's own in-process value) is deliberately not one
 * of them: config/security.config.ts's isLocalDevelopment is false there by
 * design, specifically so tests/security/email-verification.test.ts keeps
 * exercising the real, non-bypassed flow. That file continuing to pass
 * unmodified is itself the regression proof that this feature left it
 * alone - not duplicated here.
 */
describe("development-only email verification bypass (Commit 3)", () => {
  it("auto-verifies a new user and skips the verification email under NODE_ENV=development", async () => {
    const result = await runBypassCheck("development");

    expect(result.emailVerified).toBe(true);
    expect(result.verificationEmailEnqueued).toBe(false);
  });

  it("does not auto-verify a new user, and still enqueues the real verification email, under NODE_ENV=production", async () => {
    const result = await runBypassCheck("production");

    expect(result.emailVerified).toBe(false);
    expect(result.verificationEmailEnqueued).toBe(true);
  });
});
