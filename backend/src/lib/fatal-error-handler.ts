export interface FatalErrorHandlerOptions {
  process: Pick<NodeJS.Process, "on">;
  shutdown: (exitCode: number) => void | Promise<void>;
}

/**
 * Node's own default for both events already terminates the process
 * (uncaughtException always has; unhandledRejection has defaulted to
 * `throw`, i.e. crash, since Node 15) - registering these handlers isn't
 * what stops the process from staying alive in a corrupted state, Node
 * already prevents that. What this adds is running the application's own
 * graceful shutdown (closing the HTTP server / Socket.IO / BullMQ workers /
 * Prisma as applicable) before exiting, and a clear log line identifying
 * which of the two fatal conditions fired, instead of Node's default raw
 * stack dump and an unclean kill.
 *
 * Knows nothing about TeamOS internals - `shutdown` is passed in by the
 * caller (server.ts/worker.ts), which is what lets the exact same
 * already-idempotent shutdown() function used for SIGTERM/SIGINT be reused
 * here without this module importing either of them.
 */
export function registerFatalErrorHandlers({
  process,
  shutdown,
}: FatalErrorHandlerOptions): void {
  process.on("uncaughtException", (error) => {
    console.error(
      "Fatal: uncaughtException - initiating graceful shutdown.",
      error,
    );

    void shutdown(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error(
      "Fatal: unhandledRejection - initiating graceful shutdown.",
      reason,
    );

    void shutdown(1);
  });
}
