/**
 * Standalone script, not a Vitest test file - same rationale as
 * trust-proxy-hops-production-check.ts: config/security.config.ts's
 * `requireEmailVerification` is a module-level const frozen at first import,
 * so each REQUIRE_EMAIL_VERIFICATION value has to be observed in its own
 * process rather than by mutating process.env mid-suite.
 *
 * No server or database needed - the value is a pure derivation of
 * process.env. Prints "OK:<value>" or "ERROR:<message>", always exiting 0,
 * so the calling test asserts on stdout alone.
 */
async function main() {
  try {
    const { requireEmailVerification } = await import("../../src/config/security.config.js");

    await new Promise<void>((resolve) => {
      process.stdout.write(`OK:${requireEmailVerification}`, () => resolve());
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await new Promise<void>((resolve) => {
      process.stdout.write(`ERROR:${message}`, () => resolve());
    });
  }

  process.exit(0);
}

void main();
