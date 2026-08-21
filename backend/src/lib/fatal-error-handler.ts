/**
 * Only the two event registrations this module actually uses - narrower
 * than Pick<NodeJS.Process, "on">, which pulls in every overload of
 * Process.on (SIGTERM, exit, beforeExit, ...) even though only these two
 * are ever registered here. Listener parameter shapes match Node's real
 * UncaughtExceptionListener/UnhandledRejectionListener types (see
 * @types/node/process.d.ts) so the real global `process` object satisfies
 * this interface structurally, with no cast needed at the call site in
 * server.ts/worker.ts.
 */
import { logger } from "./logger.js";

export interface FatalErrorEmitter {
  on(
    event: "uncaughtException",
    listener: (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => void,
  ): unknown;
  on(
    event: "unhandledRejection",
    listener: (reason: unknown, promise: Promise<unknown>) => void,
  ): unknown;
}

export interface FatalErrorHandlerOptions {
  process: FatalErrorEmitter;
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
    logger.error({ err: error }, "Fatal: uncaughtException - initiating graceful shutdown.");

    void shutdown(1);
  });

  process.on("unhandledRejection", (reason) => {
    // `reason` isn't required to be an Error - a rejected promise can
    // reject with any value. pino's err serializer degrades gracefully for
    // a non-Error value (see logger.ts), so this is passed through as-is
    // rather than assuming .message/.stack exist.
    logger.error({ err: reason }, "Fatal: unhandledRejection - initiating graceful shutdown.");

    void shutdown(1);
  });
}
