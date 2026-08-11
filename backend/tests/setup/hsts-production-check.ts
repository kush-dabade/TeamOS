/**
 * Standalone script, not a Vitest test file - invoked as a child process
 * with NODE_ENV=production so config/security.config.ts's `isProduction`
 * (a module-level const, computed once at first import from
 * process.env.NODE_ENV) evaluates to true.
 *
 * This can't be done inside the main Vitest run: `isProduction` is frozen
 * the moment security.config.ts is first imported, and every test file in
 * this suite already imports src/app.js (directly or via tests/setup/
 * test-server.ts) under the suite's normal development configuration.
 * Mutating process.env.NODE_ENV mid-suite wouldn't retroactively change an
 * already-evaluated const, and could leak into other files depending on
 * Vitest's worker reuse - a genuinely separate process sidesteps that
 * entirely rather than relying on an assumption about isolation semantics.
 *
 * Prints only the Strict-Transport-Security header value (or "ABSENT") to
 * stdout, then exits - the calling test parses stdout directly.
 */
import { startTestServer } from "./test-server.js";

async function main() {
  const server = await startTestServer();

  const res = await fetch(`${server.baseUrl}/health`);
  const hsts = res.headers.get("strict-transport-security");

  process.stdout.write(hsts ?? "ABSENT");

  await server.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
