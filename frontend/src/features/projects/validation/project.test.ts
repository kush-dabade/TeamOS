import { describe, expect, it } from "vitest";

import { projectSchema } from "./project";

// Mirrors backend/src/modules/project/project.schema.ts so the form rejects
// what the API would reject, instead of surfacing a server error (audit F-19).
describe("projectSchema matches the server's rules", () => {
  const valid = { name: "Launch", description: "", status: "PLANNED" as const };

  it("requires at least 3 characters in the name", () => {
    expect(projectSchema.safeParse({ ...valid, name: "AB" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, name: "ABC" }).success).toBe(true);
  });

  it("caps the description at 2000 characters", () => {
    expect(projectSchema.safeParse({ ...valid, description: "d".repeat(2000) }).success).toBe(true);
    expect(projectSchema.safeParse({ ...valid, description: "d".repeat(2001) }).success).toBe(false);
  });
});
