import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerFatalErrorHandlers,
  type FatalErrorEmitter,
} from "../../src/lib/fatal-error-handler.js";

/**
 * Commit 9: uncaughtException/unhandledRejection previously had no
 * process-level handler - Node's own default already terminates the
 * process either way, this closes the gap in HOW it terminates (no
 * graceful resource cleanup, no application-level fatal log).
 *
 * Uses a fake process-like target (captures registered handlers instead of
 * calling the real global process.on) so this test never registers a real
 * listener on the actual Vitest process and never calls process.exit() -
 * see backend/src/lib/fatal-error-handler.ts's own doc comment for why
 * Node's default behavior means this is about shutdown quality, not
 * preventing an otherwise-unbounded hang.
 */
describe("registerFatalErrorHandlers", () => {
  type UncaughtExceptionHandler = (
    error: Error,
    origin: NodeJS.UncaughtExceptionOrigin,
  ) => void;
  type UnhandledRejectionHandler = (
    reason: unknown,
    promise: Promise<unknown>,
  ) => void;

  let uncaughtExceptionHandler: UncaughtExceptionHandler | undefined;
  let unhandledRejectionHandler: UnhandledRejectionHandler | undefined;
  let fakeProcess: FatalErrorEmitter;
  let shutdown: (exitCode: number) => void;
  let shutdownCalls: number[];
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    uncaughtExceptionHandler = undefined;
    unhandledRejectionHandler = undefined;

    fakeProcess = {
      // Implementing an overloaded interface method requires the body to
      // accept the union of every declared parameter type - TypeScript
      // can't correlate `event`'s narrowed value with `listener`'s
      // matching overload from inside one shared function body. Narrowing
      // back down per-branch (the two casts below) is the standard
      // pattern for implementing a TS overload, not a workaround.
      on(event, listener) {
        if (event === "uncaughtException") {
          uncaughtExceptionHandler = listener as UncaughtExceptionHandler;
        } else {
          unhandledRejectionHandler = listener as UnhandledRejectionHandler;
        }

        return undefined;
      },
    };

    shutdownCalls = [];
    shutdown = (exitCode: number) => {
      shutdownCalls.push(exitCode);
    };
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("registers both uncaughtException and unhandledRejection handlers", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    expect(uncaughtExceptionHandler).toBeDefined();
    expect(unhandledRejectionHandler).toBeDefined();
  });

  it("logs and invokes shutdown(1) on uncaughtException", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    const error = new Error("boom");
    uncaughtExceptionHandler!(error, "uncaughtException");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("uncaughtException"),
      error,
    );
    expect(shutdownCalls).toEqual([1]);
  });

  it("logs and invokes shutdown(1) on unhandledRejection", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    const reason = new Error("rejected");
    unhandledRejectionHandler!(reason, Promise.reject(reason).catch(() => {}));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("unhandledRejection"),
      reason,
    );
    expect(shutdownCalls).toEqual([1]);
  });

  it("logs a non-Error rejection reason safely instead of assuming .message/.stack", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    // A rejected promise's reason isn't required to be an Error - reject("some string")
    // or reject({ code: "X" }) are both valid, so the handler must not assume shape.
    expect(() =>
      unhandledRejectionHandler!("plain string reason", Promise.resolve()),
    ).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("unhandledRejection"),
      "plain string reason",
    );
    expect(shutdownCalls).toEqual([1]);
  });

  it("does not deduplicate across repeated fatal events - that's the injected shutdown's job", () => {
    // This module deliberately has no dedup state of its own: server.ts and
    // worker.ts's real shutdown() functions already guard against
    // concurrent/repeated invocation, so duplicating that guard here would
    // be redundant statefulness for no benefit. Two independent fatal
    // events are expected to both reach the injected shutdown callback -
    // it's shutdown()'s existing guard, not this module, that makes a
    // repeated call a no-op in production.
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    uncaughtExceptionHandler!(new Error("first"), "uncaughtException");
    unhandledRejectionHandler!(new Error("second"), Promise.resolve());

    expect(shutdownCalls).toEqual([1, 1]);
  });
});
