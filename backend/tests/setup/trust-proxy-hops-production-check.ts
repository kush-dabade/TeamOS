/**
 * Standalone script, not a Vitest test file - same rationale as
 * hsts-production-check.ts: config/security.config.ts's `isProduction` and
 * `trustProxyHops` are module-level consts frozen at first import, so
 * proving production-mode validation requires a genuinely separate process
 * with NODE_ENV=production, not mutating process.env mid-suite.
 *
 * Importing ../../src/app.js pulls in security.config.ts, which throws
 * synchronously at import time if TRUST_PROXY_HOPS is missing in
 * production. Prints "OK:<value>" (the resolved app.get("trust proxy"))
 * on success or "ERROR:<message>" on failure, always exiting 0 either way -
 * the calling test asserts on stdout content rather than juggling process
 * exit codes and stderr separately.
 */
async function main() {
  try {
    const { default: app } = await import("../../src/app.js");

    await new Promise<void>((resolve) => {
      process.stdout.write(`OK:${app.get("trust proxy")}`, () => resolve());
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await new Promise<void>((resolve) => {
      process.stdout.write(`ERROR:${message}`, () => resolve());
    });
  }

  process.exit(0);
}

main();
