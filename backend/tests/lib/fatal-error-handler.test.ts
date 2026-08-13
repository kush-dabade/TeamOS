import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerFatalErrorHandlers } from "../../src/lib/fatal-error-handler.js";

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
  type Handler = (...args: unknown[]) => void;

  let handlers: Map<string, Handler>;
  let fakeProcess: { on: (event: string, handler: Handler) => void };
  let shutdown: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handlers = new Map();
    fakeProcess = {
      on: (event, handler) => {
        handlers.set(event, handler);
      },
    };
    shutdown = vi.fn();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("registers both uncaughtException and unhandledRejection handlers", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    expect(handlers.has("uncaughtException")).toBe(true);
    expect(handlers.has("unhandledRejection")).toBe(true);
  });

  it("logs and invokes shutdown(1) on uncaughtException", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    const error = new Error("boom");
    handlers.get("uncaughtException")!(error);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("uncaughtException"),
      error,
    );
    expect(shutdown).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("logs and invokes shutdown(1) on unhandledRejection", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    const reason = new Error("rejected");
    handlers.get("unhandledRejection")!(reason);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("unhandledRejection"),
      reason,
    );
    expect(shutdown).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("logs a non-Error rejection reason safely instead of assuming .message/.stack", () => {
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    // A rejected promise's reason isn't required to be an Error - reject("some string")
    // or reject({ code: "X" }) are both valid, so the handler must not assume shape.
    expect(() => handlers.get("unhandledRejection")!("plain string reason")).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("unhandledRejection"),
      "plain string reason",
    );
    expect(shutdown).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("does not deduplicate across repeated fatal events - that's the injected shutdown's job", () => {
    // This module deliberately has no dedup state of its own: server.ts and
    // worker.ts's real shutdown() functions already guard against
    // concurrent/repeated invocation (isShuttingDown), so duplicating that
    // guard here would be redundant statefulness for no benefit. Two
    // independent fatal events are expected to both reach the injected
    // shutdown callback - it's shutdown()'s existing guard, not this
    // module, that makes the second call a no-op in production.
    registerFatalErrorHandlers({ process: fakeProcess, shutdown });

    handlers.get("uncaughtException")!(new Error("first"));
    handlers.get("unhandledRejection")!(new Error("second"));

    expect(shutdown).toHaveBeenCalledTimes(2);
  });
});
