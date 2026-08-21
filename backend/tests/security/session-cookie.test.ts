import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { startTestServer, type TestServer } from "../setup/test-server.js";
import { resetDatabase } from "../setup/reset-database.js";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SECURE_COOKIE_CHECK_SCRIPT = path.join(
  backendRoot,
  "tests/setup/secure-cookie-production-check.ts",
);

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

describe("session cookie configuration (P2-COOKIE)", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("sets an HttpOnly, SameSite=Lax session cookie with the configured Max-Age on sign-in", async () => {
    const email = `session-cookie-${crypto.randomUUID()}@example.com`;
    const password = "password1234";

    const signUpResponse = await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: "Session Cookie Test", email, password })
      .expect(200);

    const userId = signUpResponse.body.user.id as string;

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    const signInResponse = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password })
      .expect(200);

    // @types/superagent types Response.headers as { [k: string]: string },
    // but Node's http layer always exposes repeated headers like set-cookie
    // as a real string[] - same caveat fixtures.ts's signUpTestUser notes.
    const setCookie = signInResponse.headers["set-cookie"] as unknown as string[] | undefined;
    const sessionCookie = setCookie?.find((entry) => entry.includes("session_token"));

    expect(sessionCookie).toBeDefined();

    const attributes = sessionCookie!.split(";").map((part) => part.trim().toLowerCase());

    // Not the __Secure- prefixed name here - this suite runs under
    // development config (NODE_ENV unset, see config/security.config.ts),
    // so isProduction is false and useSecureCookies is off. The production
    // case (secure prefix + attribute) is covered by the separate-process
    // check below, for the same reason hsts-production-check.ts exists as
    // its own process rather than a mutated process.env.
    expect(sessionCookie).toMatch(/^better-auth\.session_token=/);
    expect(attributes).toContain("httponly");
    expect(attributes).toContain("samesite=lax");
    expect(attributes).not.toContain("secure");

    const maxAgeAttribute = attributes.find((attr) => attr.startsWith("max-age="));

    expect(maxAgeAttribute).toBeDefined();
    expect(Number(maxAgeAttribute!.split("=")[1])).toBe(SESSION_EXPIRES_IN_SECONDS);
  });

  it(
    "prefixes the session cookie name with __Secure- in production, " +
      "even when BETTER_AUTH_URL is not itself https",
    async () => {
      // See secure-cookie-production-check.ts's own comment for why this
      // runs as a genuinely separate process instead of toggling
      // process.env.NODE_ENV inline.
      const { stdout } = await execFileAsync("npx", ["tsx", SECURE_COOKIE_CHECK_SCRIPT], {
        cwd: backendRoot,
        env: { ...process.env, NODE_ENV: "production" },
      });

      expect(stdout.trim()).toBe("__Secure-better-auth.session_token");
    },
  );
});
