/**
 * Standalone script, not a Vitest test file - same rationale as
 * secure-cookie-production-check.ts / dev-verification-bypass-check.ts:
 * config/security.config.ts's isProduction/isLocalDevelopment are
 * module-level consts frozen at first import, so a real child process is
 * the only reliable way to observe their value across the NODE_ENV values
 * this file branches on - including NODE_ENV being entirely unset, which
 * this test process's own in-process run (always NODE_ENV=test, via Vitest)
 * can never exercise itself.
 *
 * No server or database needed - isProduction/isLocalDevelopment are pure
 * derivations of process.env.NODE_ENV, so this just imports the module and
 * reports what it computed.
 */
import { isLocalDevelopment, isProduction } from "../../src/config/security.config.js";

process.stdout.write(JSON.stringify({ isProduction, isLocalDevelopment }));
