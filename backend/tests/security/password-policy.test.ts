import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  PASSWORD_MAX_LENGTH,
  generateRandomCompliantPassword,
  passwordPolicyViolation,
  userNameViolation,
} from "../../src/lib/password-policy.js";

import { resetDatabase } from "../setup/reset-database.js";
import { signUpTestUser } from "../setup/fixtures.js";

// Regression (audit F-19): the forms advertised "8+ characters, uppercase,
// lowercase, number" and a 50-character name, but only the browser
// enforced it - any other client could register "password" or a 10,000
// character name.

function signUp(body: Record<string, unknown>) {
  return request(app).post("/api/auth/sign-up/email").send(body);
}

describe("password and name policy", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it.each([
    ["no uppercase letter", "password1234", "uppercase"],
    ["no lowercase letter", "PASSWORD1234", "lowercase"],
    ["no number", "PasswordOnly", "number"],
    ["too short", "Pass1", "at least 8"],
    ["too long", `Aa1${"x".repeat(PASSWORD_MAX_LENGTH)}`, "cannot exceed"],
  ])("rejects a sign-up password with %s and creates no account", async (_case, password, hint) => {
    const email = `policy-${crypto.randomUUID()}@example.com`;

    const res = await signUp({ name: "Policy Test", email, password }).expect(400);

    expect(res.body.message).toContain(hint);
    await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
  });

  it.each([
    ["blank", "   "],
    ["over 50 characters", "n".repeat(51)],
  ])("rejects a %s name at sign-up", async (_case, name) => {
    const email = `policy-${crypto.randomUUID()}@example.com`;

    const res = await signUp({ name, email, password: "Password1234" }).expect(400);

    expect(res.body.code).toBe("INVALID_NAME");
    await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
  });

  it("accepts a compliant sign-up", async () => {
    await signUp({
      name: "Ada Lovelace",
      email: `policy-${crypto.randomUUID()}@example.com`,
      password: "Password1234",
    }).expect(200);
  });

  it("applies the password rules to reset-password before the token is even checked", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "any-token", newPassword: "weakpassword" })
      .expect(400);

    expect(res.body.code).toBe("PASSWORD_POLICY_VIOLATION");
  });

  it("applies the password rules to change-password", async () => {
    const user = await signUpTestUser(app);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", user.cookie)
      .send({ currentPassword: user.password, newPassword: "alllowercase1" })
      .expect(400);

    expect(res.body.code).toBe("PASSWORD_POLICY_VIOLATION");

    // Still signs in with the unchanged password.
    await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: user.password })
      .expect(200);
  });

  it("applies the name rules to profile updates", async () => {
    const user = await signUpTestUser(app);

    const res = await request(app)
      .post("/api/auth/update-user")
      .set("Cookie", user.cookie)
      .send({ name: "n".repeat(51) })
      .expect(400);

    expect(res.body.code).toBe("INVALID_NAME");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    expect(stored.name).toBe("Test User");
  });

  it("does not apply the rules at sign-in, so existing passwords keep working", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: `nobody-${crypto.randomUUID()}@example.com`, password: "weak" });

    expect(res.body.code).not.toBe("PASSWORD_POLICY_VIOLATION");
  });
});

describe("password-policy helpers", () => {
  it("generates demo passwords that always satisfy the policy", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(passwordPolicyViolation(generateRandomCompliantPassword())).toBeNull();
    }
  });

  it("trims names before measuring them", () => {
    expect(userNameViolation(`  ${"n".repeat(50)}  `)).toBeNull();
  });
});
