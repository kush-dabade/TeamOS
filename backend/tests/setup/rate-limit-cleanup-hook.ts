import { afterEach } from "vitest";

import { resetRateLimitState } from "./reset-rate-limits.js";

// Registered as a Vitest setupFile (see vitest.config.ts) so every test
// file gets this automatically, not just the ones under tests/security/.
// Commit 5's general rate limiter is mounted at /api/v1 in app.ts, so ANY
// test that hits those routes - including pre-existing Commit 3/4 files
// that predate rate limiting entirely, e.g. tests/setup/harness.smoke.test.ts's
// GET /api/v1/workspaces - writes a Redis counter that would otherwise
// leak into whatever runs next against the same shared Redis instance. A
// single global hook here is more robust than relying on every individual
// test file to remember to call resetRateLimitState() in its own
// afterEach - one omission (a real one, caught while validating this
// commit) is enough to leave stale keys behind.
afterEach(async () => {
  await resetRateLimitState();
});
