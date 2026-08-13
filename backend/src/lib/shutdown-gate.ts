export interface ShutdownGate {
  /**
   * Records a shutdown request. Returns true only for the first call - the
   * one that should actually run the cleanup sequence. Every call
   * (including ones that return false because cleanup is already in
   * progress) still upgrades the eventual exit code via Math.max, so a
   * fatal error arriving while a graceful SIGTERM shutdown is already
   * running can't have its non-zero exit code silently lost - it just
   * doesn't get a second, competing cleanup run.
   */
  requestShutdown(exitCode: number): boolean;

  /** The highest exit code requested across every call so far. */
  getExitCode(): number;
}

export function createShutdownGate(): ShutdownGate {
  let inProgress = false;
  let exitCode = 0;

  return {
    requestShutdown(requestedExitCode: number): boolean {
      exitCode = Math.max(exitCode, requestedExitCode);

      if (inProgress) {
        return false;
      }

      inProgress = true;
      return true;
    },
    getExitCode(): number {
      return exitCode;
    },
  };
}
