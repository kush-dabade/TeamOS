import { describe, expect, it } from "vitest";
import type { DestinationStream } from "pino";

import { createLogger, logger, resolveLogLevel } from "../../src/lib/logger.js";

/**
 * A minimal injectable Pino destination - collects each NDJSON record Pino
 * writes and exposes it pre-parsed. Used instead of scraping process.stdout
 * (which pino-pretty's worker-thread transport makes awkward to intercept
 * anyway, and which several existing tests in this suite already avoid in
 * favor of a genuinely separate, inspectable channel - see
 * hsts-production-check.ts).
 */
function createMemoryStream(): DestinationStream & { records: () => Record<string, unknown>[] } {
  let buffer = "";

  return {
    write(chunk: string) {
      buffer += chunk;
    },
    records() {
      return buffer
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  };
}

describe("resolveLogLevel", () => {
  it("defaults to a quiet-but-not-silent level in test, so real errors still print", () => {
    expect(resolveLogLevel({ NODE_ENV: "test" })).toBe("error");
  });

  it("defaults to info in production", () => {
    expect(resolveLogLevel({ NODE_ENV: "production" })).toBe("info");
  });

  it("defaults to debug outside production/test (development, or NODE_ENV unset)", () => {
    expect(resolveLogLevel({ NODE_ENV: undefined })).toBe("debug");
    expect(resolveLogLevel({ NODE_ENV: "development" })).toBe("debug");
  });

  it("lets an explicit LOG_LEVEL win over every NODE_ENV default", () => {
    expect(resolveLogLevel({ NODE_ENV: "test", LOG_LEVEL: "debug" })).toBe("debug");
    expect(resolveLogLevel({ NODE_ENV: "production", LOG_LEVEL: "warn" })).toBe("warn");
  });
});

describe("createLogger", () => {
  it("can be created and produces a usable logger", () => {
    const stream = createMemoryStream();
    const testLogger = createLogger({ stream, level: "info" });

    testLogger.info("hello");

    expect(stream.records()).toHaveLength(1);
    expect(stream.records()[0]?.msg).toBe("hello");
  });

  it("respects the configured level, filtering out lower-severity records", () => {
    const stream = createMemoryStream();
    const testLogger = createLogger({ stream, level: "warn" });

    testLogger.info("should be filtered out");
    testLogger.warn("should appear");
    testLogger.error("should also appear");

    const records = stream.records();

    expect(records).toHaveLength(2);
    expect(records[0]?.msg).toBe("should appear");
    expect(records[1]?.msg).toBe("should also appear");
  });

  it("serializes an Error passed under `err` with useful, structured information", () => {
    const stream = createMemoryStream();
    const testLogger = createLogger({ stream, level: "error" });

    const error = new Error("boom");

    testLogger.error({ err: error }, "operation failed");

    const record = stream.records()[0];
    const err = record?.err as { message?: string; stack?: string; type?: string } | undefined;

    expect(record?.msg).toBe("operation failed");
    expect(err?.message).toBe("boom");
    expect(err?.type).toBe("Error");
    expect(err?.stack).toContain("Error: boom");
  });

  it("preserves structured fields on a child logger across multiple log calls", () => {
    const stream = createMemoryStream();
    const testLogger = createLogger({ stream, level: "info" });
    const child = testLogger.child({ jobId: "job-123", jobName: "email-verification" });

    child.info("processing");
    child.info("completed");

    const records = stream.records();

    expect(records).toHaveLength(2);

    for (const record of records) {
      expect(record.jobId).toBe("job-123");
      expect(record.jobName).toBe("email-verification");
    }
  });

  it("outputs a human-readable level label rather than Pino's raw numeric level", () => {
    const stream = createMemoryStream();
    const testLogger = createLogger({ stream, level: "info" });

    testLogger.info("hello");

    expect(stream.records()[0]?.level).toBe("info");
  });
});

describe("logger (app-wide singleton)", () => {
  it("is a usable Pino logger with child-logger support", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("defaults to a quiet level in this test run without needing any test-specific setup", () => {
    // This suite runs with NODE_ENV=test (Vitest's own default) and no
    // LOG_LEVEL set in .env.test - so the singleton built at import time
    // should already have resolved to "error", matching
    // resolveLogLevel's own test-mode default above.
    expect(logger.level).toBe("error");
  });
});
