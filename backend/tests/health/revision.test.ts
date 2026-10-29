import { describe, expect, it } from "vitest";

import { parseAppRevision } from "../../src/config/release.config.js";

// /health reports this value publicly, so anything other than a full commit
// SHA must come back as null rather than being echoed.
describe("parseAppRevision", () => {
  it("accepts a full lowercase commit SHA", () => {
    const sha = "3d9c640742cce2ee4a1b8967299eb7714f67c38e";

    expect(parseAppRevision(sha)).toBe(sha);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["abbreviated", "3d9c640"],
    ["uppercase", "3D9C640742CCE2EE4A1B8967299EB7714F67C38E"],
    ["not hex", "not-a-commit-sha-but-forty-characters-xx"],
    ["padded", " 3d9c640742cce2ee4a1b8967299eb7714f67c38e"],
  ])("reports %s values as null", (_label, value) => {
    expect(parseAppRevision(value)).toBeNull();
  });
});
