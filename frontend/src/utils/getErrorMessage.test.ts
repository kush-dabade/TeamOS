import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./getErrorMessage";

const FALLBACK = "Something went wrong. Please try again.";

describe("getErrorMessage", () => {
  it("returns a non-empty Error message", () => {
    expect(getErrorMessage(new Error("Project name already exists"))).toBe(
      "Project name already exists",
    );
  });

  it("returns a non-empty object.message string", () => {
    expect(getErrorMessage({ type: "validation", message: "Comment failed moderation" })).toBe(
      "Comment failed moderation",
    );
  });

  it("falls back to the generic message for an empty Error message", () => {
    expect(getErrorMessage(new Error(""))).toBe(FALLBACK);
  });

  it("falls back to the generic message for a whitespace-only Error message", () => {
    expect(getErrorMessage(new Error("   "))).toBe(FALLBACK);
  });

  it("falls back to the generic message for an empty object.message string", () => {
    expect(getErrorMessage({ type: "unknown", message: "" })).toBe(FALLBACK);
  });

  it("falls back to the generic message for a whitespace-only object.message string", () => {
    expect(getErrorMessage({ type: "unknown", message: "   " })).toBe(FALLBACK);
  });

  it("falls back to the generic message for an unrecognized error shape", () => {
    expect(getErrorMessage("network down")).toBe(FALLBACK);
    expect(getErrorMessage(null)).toBe(FALLBACK);
    expect(getErrorMessage(undefined)).toBe(FALLBACK);
    expect(getErrorMessage({})).toBe(FALLBACK);
  });
});
