import { describe, expect, it } from "vitest";

import { createShutdownGate } from "../../src/lib/shutdown-gate.js";

/**
 * CodeRabbit finding on PR #66: server.ts/worker.ts's shutdown() used a
 * plain boolean isShuttingDown guard - if a fatal error (exit code 1)
 * arrived while a SIGTERM-triggered shutdown (exit code 0) was already in
 * progress, the fatal request returned immediately without upgrading the
 * exit code, so the process could finish with exit 0 despite the fatal
 * error. createShutdownGate() fixes this: every request contributes to the
 * eventual exit code via Math.max, only the first request runs cleanup.
 *
 * Pure and synchronous by design (no timers, no process, no real I/O) so
 * the exact SIGTERM-then-fatal ordering is deterministic here, not
 * timing-dependent - see the Docker-based runtime validation in this
 * commit's report for a real end-to-end proof against the compiled worker.
 */
describe("createShutdownGate", () => {
  it("runs cleanup on the first request and reports its exit code", () => {
    const gate = createShutdownGate();

    expect(gate.requestShutdown(0)).toBe(true);
    expect(gate.getExitCode()).toBe(0);
  });

  it("does not run cleanup twice for a repeated request", () => {
    const gate = createShutdownGate();

    gate.requestShutdown(0);

    expect(gate.requestShutdown(0)).toBe(false);
  });

  it("upgrades the exit code when a fatal error arrives while a graceful shutdown is already in progress", () => {
    const gate = createShutdownGate();

    // SIGTERM arrives first: shutdown begins, cleanup should run, exit
    // code starts at 0.
    expect(gate.requestShutdown(0)).toBe(true);
    expect(gate.getExitCode()).toBe(0);

    // A fatal error fires while that shutdown is still in progress:
    // cleanup must not run a second time (false - idempotent), but the
    // exit code this same in-flight shutdown will eventually use must be
    // upgraded to 1, not silently lost.
    expect(gate.requestShutdown(1)).toBe(false);
    expect(gate.getExitCode()).toBe(1);
  });

  it("keeps the higher exit code even if a lower one arrives afterward", () => {
    const gate = createShutdownGate();

    gate.requestShutdown(1);

    expect(gate.requestShutdown(0)).toBe(false);
    expect(gate.getExitCode()).toBe(1);
  });
});
