import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import app from "../../src/app.js";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TRUST_PROXY_CHECK_SCRIPT = path.join(
  backendRoot,
  "tests/setup/trust-proxy-hops-production-check.ts",
);

describe("TRUST_PROXY_HOPS validation", () => {
  it("defaults to 0 and starts normally outside production", () => {
    // The whole suite runs under the test environment's configuration
    // (NODE_ENV unset -> "development", see config/security.config.ts) -
    // this is the same in-process app every other test file uses, proving
    // dev/test startup is unaffected by the production-only requirement
    // added below.
    expect(app.get("trust proxy")).toBe(0);
  });

  it("fails to start in production when TRUST_PROXY_HOPS is not set", async () => {
    // .env.test sets TRUST_PROXY_HOPS=0 (loaded into this process's env by
    // tests/setup/test-env.ts), and execFileAsync's env option below
    // otherwise inherits process.env wholesale - this strips it back out so
    // the child process genuinely sees it as unset, not "set to 0".
    const envWithoutTrustProxyHops = { ...process.env };
    delete envWithoutTrustProxyHops.TRUST_PROXY_HOPS;

    const { stdout } = await execFileAsync("npx", ["tsx", TRUST_PROXY_CHECK_SCRIPT], {
      cwd: backendRoot,
      env: { ...envWithoutTrustProxyHops, NODE_ENV: "production" },
    });

    expect(stdout.trim()).toMatch(/^ERROR:.*TRUST_PROXY_HOPS/);
  });

  it("rejects an empty/whitespace-only TRUST_PROXY_HOPS value in production", async () => {
    // A single whitespace-only value exercises both the "empty" and
    // "whitespace-only" cases in one test, since parseTrustProxyHops trims
    // before checking emptiness - a literal "" would hit the exact same
    // code path.
    const { stdout } = await execFileAsync("npx", ["tsx", TRUST_PROXY_CHECK_SCRIPT], {
      cwd: backendRoot,
      env: { ...process.env, NODE_ENV: "production", TRUST_PROXY_HOPS: "   " },
    });

    expect(stdout.trim()).toMatch(/^ERROR:.*TRUST_PROXY_HOPS/);
  });

  it("accepts an explicit TRUST_PROXY_HOPS value in production", async () => {
    const { stdout } = await execFileAsync("npx", ["tsx", TRUST_PROXY_CHECK_SCRIPT], {
      cwd: backendRoot,
      env: { ...process.env, NODE_ENV: "production", TRUST_PROXY_HOPS: "2" },
    });

    expect(stdout.trim()).toBe("OK:2");
  });
});
