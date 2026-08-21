import pino, { type DestinationStream, type Logger } from "pino";

const nodeEnv = process.env.NODE_ENV ?? "development";

/**
 * Pure and exported specifically so this can be unit-tested directly,
 * rather than only indirectly through the frozen-at-import-time singleton
 * below (the same "module-level const computed once at first import"
 * caveat config/security.config.ts's isProduction already has - see e.g.
 * hsts-production-check.ts's comment on why that requires a genuinely
 * separate process to test both branches). Level selection here is pure
 * config logic with no such singleton, so it doesn't need that workaround.
 *
 * LOG_LEVEL always wins when set, in every environment - this only chooses
 * the default when it's absent:
 *   - test: "error" - Vitest sets NODE_ENV=test itself (confirmed: none of
 *     this suite's own env vars set it). Quiet by default so info/warn
 *     lifecycle noise from the ~60 sites this logger replaces doesn't
 *     flood test output the way raw console.* calls would, but real error
 *     logs still print - "quiet" must not mean "silent," since a failing
 *     test is often easier to diagnose with its surrounding error log
 *     still visible.
 *   - production: "info" - lifecycle + real failures, no debug noise.
 *   - anything else (development, unset): "debug" - maximum local
 *     visibility by default, the same spirit as this app already having no
 *     log level concept at all today (every console.log/error always
 *     printed).
 */
export function resolveLogLevel(env: {
  NODE_ENV?: string | undefined;
  LOG_LEVEL?: string | undefined;
}): string {
  if (env.LOG_LEVEL) {
    return env.LOG_LEVEL;
  }

  if (env.NODE_ENV === "test") {
    return "error";
  }

  if (env.NODE_ENV === "production") {
    return "info";
  }

  return "debug";
}

const level = resolveLogLevel({ NODE_ENV: process.env.NODE_ENV, LOG_LEVEL: process.env.LOG_LEVEL });

// Pretty-printed, colorized output is a local-development convenience only -
// never in production (where a real log consumer wants plain JSON, not
// ANSI-colored text) and never in test (pino-pretty is a worker-thread
// transport; spinning it up for every test-file's import of this module
// would slow the suite for output nothing reads, since tests assert on
// logger.ts's own behavior via an injected stream - see createLogger below -
// not on this singleton's stdout).
const usePrettyOutput = nodeEnv !== "production" && nodeEnv !== "test";

export interface CreateLoggerOptions {
  /**
   * Injectable destination, used by logger.test.ts to assert on emitted
   * records directly instead of scraping process.stdout. Every real call
   * site (the `logger` singleton below) omits this and gets the real
   * stdout/pretty-transport behavior.
   */
  stream?: DestinationStream;
  /** Defaults to the module-level `level` (see resolveLogLevel above). Only overridden by tests that need to exercise a specific level's filtering behavior in isolation from process.env. */
  level?: string;
}

/**
 * Factory rather than only exporting a singleton: tests need a logger
 * writing to an injectable, inspectable destination instead of the real
 * process.stdout (see docs/testing conventions elsewhere in this repo -
 * e.g. hsts-production-check.ts already prefers a genuinely separate,
 * inspectable output channel over scraping global state). Every other
 * caller in the app just uses the `logger` singleton below.
 */
export function createLogger({ stream, level: levelOverride }: CreateLoggerOptions = {}): Logger {
  const options = {
    level: levelOverride ?? level,
    // ISO timestamps read naturally in both pino-pretty's local output and
    // raw JSON in prod/CI logs - pino's own default is a bare epoch-ms
    // number, which is fine for machines but not for a "keep this small,
    // no log platform" setup where a human is often the one reading prod
    // JSON logs directly (e.g. `docker compose logs backend`).
    timestamp: pino.stdTimeFunctions.isoTime,
    // Pino's default numeric level (e.g. 30) is only meaningful with a
    // level-aware log viewer, which this project doesn't have. The label
    // ("info", "error", ...) is what both a human skimming Docker logs and
    // the pretty transport below already expect.
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  };

  if (stream) {
    return pino(options, stream);
  }

  if (usePrettyOutput) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino(options);
}

/**
 * The shared base logger every API and worker-process call site in this
 * app imports. Pino's own `.child({ ... })` (e.g. `logger.child({ jobId,
 * jobName })` in a worker, or `logger.child({ requestId })` once P2-REQID
 * lands) is the correlation mechanism - nothing extra needs building here
 * for that to work.
 *
 * Error objects should be passed under an `err` key - e.g.
 * `logger.error({ err: error }, "message")`, not
 * `logger.error("message", error)` - so pino's built-in stdSerializers.err
 * (registered by default; verified against the installed package) expands
 * it into structured { message, stack, type } fields instead of relying on
 * whatever toString()/util.inspect output console.error used to produce.
 */
export const logger = createLogger();
