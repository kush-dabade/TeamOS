import { describe, expect, it } from "vitest";

import { registerSchema } from "./register";

// Mirrors backend/src/lib/password-policy.ts (audit F-19).
describe("registerSchema matches the server's password policy", () => {
  function parse(password: string) {
    return registerSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password,
      confirmPassword: password,
    });
  }

  it("accepts passwords up to 128 characters and rejects longer ones", () => {
    expect(parse(`Aa1${"x".repeat(125)}`).success).toBe(true);
    expect(parse(`Aa1${"x".repeat(126)}`).success).toBe(false);
  });

  it("requires uppercase, lowercase and a number", () => {
    expect(parse("password1234").success).toBe(false);
    expect(parse("PASSWORD1234").success).toBe(false);
    expect(parse("PasswordOnly").success).toBe(false);
    expect(parse("Password1234").success).toBe(true);
  });
});
