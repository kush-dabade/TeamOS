import { describe, expect, it } from "vitest";

import { isShuttingDown, markShuttingDown } from "../../src/lib/shutdown-state.js";

/**
 * shutdown-state.ts is a one-way flag with no reset export, by design (see
 * its own doc comment) - production never un-shuts-down, so this file must
 * assert the "not shutting down" default BEFORE the "marked" state, never
 * the reverse, and never rely on resetting between tests. Vitest gives each
 * test *file* its own fresh module registry (see test-server.ts's comment
 * on the realtime `io` singleton for the same property applied elsewhere),
 * so this file's mutation of the flag cannot leak into any other test file
 * - only the ordering within this one file needs care.
 */
describe("shutdown-state", () => {
  it("defaults to not shutting down", () => {
    expect(isShuttingDown()).toBe(false);
  });

  it("reports shutting down after markShuttingDown() is called", () => {
    markShuttingDown();

    expect(isShuttingDown()).toBe(true);
  });

  it("stays shutting down on a second markShuttingDown() call (idempotent, one-way)", () => {
    markShuttingDown();

    expect(isShuttingDown()).toBe(true);
  });
});
