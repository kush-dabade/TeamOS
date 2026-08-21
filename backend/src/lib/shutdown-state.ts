/**
 * Deliberately separate from shutdown-gate.ts's ShutdownGate: that module's
 * job is "run the cleanup sequence exactly once and track the eventual exit
 * code," which is process-lifecycle bookkeeping local to server.ts. This
 * module answers a different, narrower question - "should /ready currently
 * report unhealthy?" - that app.ts's readiness route needs to read without
 * creating a dependency on server.ts (importing server.ts from app.ts would
 * be circular: server.ts already imports app.ts).
 *
 * A bare module-level flag, not a class or gate - there is exactly one
 * transition (false -> true) for the lifetime of a process, ever. No reset
 * export is provided on purpose: production never un-shuts-down, and adding
 * one solely so tests could rewind it would let a false state leak back in
 * after a real shutdown started, which is the one thing this module exists
 * to prevent.
 */
let shuttingDown = false;

/** Called once, at the very start of server.ts's shutdown() - before any potentially slow cleanup. */
export function markShuttingDown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}
