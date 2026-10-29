import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { requireEmailVerification } from "../../src/config/security.config.js";

import { resetDatabase } from "../setup/reset-database.js";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_CHECK_SCRIPT = path.join(
  backendRoot,
  "tests/setup/require-email-verification-config-check.ts",
);
const FLOW_CHECK_SCRIPT = path.join(backendRoot, "tests/setup/optional-email-verification-check.ts");

// Starts from this process's env (loaded from .env.test) with
// REQUIRE_EMAIL_VERIFICATION stripped, so "unset" genuinely means unset in
// the child even if a developer's .env.test happens to set it.
function childEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.REQUIRE_EMAIL_VERIFICATION;

  return { ...env, ...overrides };
}

async function runConfigCheck(value: string | undefined): Promise<string> {
  const { stdout } = await execFileAsync("npx", ["tsx", CONFIG_CHECK_SCRIPT], {
    cwd: backendRoot,
    env: childEnv(value === undefined ? {} : { REQUIRE_EMAIL_VERIFICATION: value }),
  });

  return stdout.trim();
}

interface FlowResult {
  signUpStatus: number;
  signUpReturnedToken: boolean;
  signUpSetSessionCookie: boolean;
  signUpSessionStatus: number | null;
  duplicateSignUpStatus: number;
  duplicateSignUpCode: string | null;
  signInStatus: number;
  signInCode: string | null;
  signInSessionStatus: number | null;
  invitationStatus: number | null;
  passwordResetStatus: number;
  emailVerified: boolean;
  verificationEmailJobs: number;
  passwordResetEmailJobs: number;
  invitationEmailJobs: number;
}

async function runFlowCheck(value: string | undefined): Promise<FlowResult> {
  const { stdout } = await execFileAsync("npx", ["tsx", FLOW_CHECK_SCRIPT], {
    cwd: backendRoot,
    // NODE_ENV=production: the environment this flag exists for, and the
    // one where the development-only auto-verify bypass (lib/auth.ts) can't
    // mask the result. LOG_LEVEL silent keeps stdout to the JSON alone.
    env: childEnv({
      NODE_ENV: "production",
      LOG_LEVEL: "silent",
      ...(value !== undefined && { REQUIRE_EMAIL_VERIFICATION: value }),
    }),
  });

  return JSON.parse(stdout) as FlowResult;
}

describe("REQUIRE_EMAIL_VERIFICATION configuration", () => {
  it("is enabled in this suite's own process, where it is unset", () => {
    expect(requireEmailVerification).toBe(true);
  });

  it("defaults to enabled when unset", async () => {
    expect(await runConfigCheck(undefined)).toBe("OK:true");
  });

  it('accepts an explicit "true"', async () => {
    expect(await runConfigCheck("true")).toBe("OK:true");
  });

  it('accepts an explicit "false"', async () => {
    expect(await runConfigCheck("false")).toBe("OK:false");
  });

  it.each(["", "FALSE", "0"])("fails fast on the invalid value %j", async (value) => {
    expect(await runConfigCheck(value)).toMatch(/^ERROR:REQUIRE_EMAIL_VERIFICATION must be/);
  });
});

describe("optional email verification (production mode)", () => {
  // The child processes write to the shared test database.
  afterEach(async () => {
    await resetDatabase();
  });

  it("with REQUIRE_EMAIL_VERIFICATION=false, signs a new user in immediately without verifying or emailing them", async () => {
    const result = await runFlowCheck("false");

    // Sign-up itself creates a working session.
    expect(result.signUpStatus).toBe(200);
    expect(result.signUpReturnedToken).toBe(true);
    expect(result.signUpSetSessionCookie).toBe(true);
    expect(result.signUpSessionStatus).toBe(200);

    // The account stays unverified, and no verification email is queued.
    expect(result.emailVerified).toBe(false);
    expect(result.verificationEmailJobs).toBe(0);

    // The approved trade-off: an existing email gets Better Auth's normal
    // error instead of the generic success response.
    expect(result.duplicateSignUpStatus).toBe(422);
    expect(result.duplicateSignUpCode).toBe("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");

    // A later sign-in works and its session reaches authenticated routes.
    expect(result.signInStatus).toBe(200);
    expect(result.signInSessionStatus).toBe(200);

    // Unrelated email is still queued exactly as before.
    expect(result.invitationStatus).toBe(201);
    expect(result.invitationEmailJobs).toBe(1);
    expect(result.passwordResetStatus).toBe(200);
    expect(result.passwordResetEmailJobs).toBe(1);
  }, 30_000);

  it("with REQUIRE_EMAIL_VERIFICATION unset, keeps the existing enforcement", async () => {
    const result = await runFlowCheck(undefined);

    expect(result.signUpStatus).toBe(200);
    expect(result.signUpReturnedToken).toBe(false);
    expect(result.signUpSetSessionCookie).toBe(false);
    expect(result.emailVerified).toBe(false);
    expect(result.verificationEmailJobs).toBe(1);

    // Generic response for an existing email, as before.
    expect(result.duplicateSignUpStatus).toBe(200);

    expect(result.signInStatus).toBe(403);
    expect(result.signInCode).toBe("EMAIL_NOT_VERIFIED");
    expect(result.signInSessionStatus).toBeNull();

    expect(result.passwordResetStatus).toBe(200);
    expect(result.passwordResetEmailJobs).toBe(1);
  }, 30_000);
});
