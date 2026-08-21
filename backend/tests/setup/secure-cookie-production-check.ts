/**
 * Standalone script, not a Vitest test file - same rationale as
 * hsts-production-check.ts: config/security.config.ts's `isProduction` is a
 * module-level const frozen at first import, so a real NODE_ENV=production
 * child process is the only reliable way to observe its effect, rather than
 * mutating process.env mid-suite and risking a leak into other test files
 * via Vitest's worker reuse.
 *
 * Signs up and signs in for a real session cookie (same flow
 * fixtures.ts's signUpTestUser uses), then prints just the session cookie's
 * name to stdout - lib/auth.ts's useSecureCookies: isProduction should make
 * Better Auth prefix it with "__Secure-" whenever this runs under
 * NODE_ENV=production.
 */
import request from "supertest";

import { prisma } from "../../src/lib/prisma.js";
import app from "../../src/app.js";
import { startTestServer } from "./test-server.js";

async function main() {
  const server = await startTestServer();

  const email = `secure-cookie-check-${crypto.randomUUID()}@example.com`;
  const password = "password1234";

  const signUpResponse = await request(app).post("/api/auth/sign-up/email").send({
    name: "Secure Cookie Check",
    email,
    password,
  });

  const userId = signUpResponse.body.user.id as string;

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  const signInResponse = await request(app).post("/api/auth/sign-in/email").send({
    email,
    password,
  });

  const setCookie = signInResponse.headers["set-cookie"] as unknown as string[] | undefined;
  const sessionCookie = setCookie?.find((entry) => entry.includes("session_token"));
  const cookieName = sessionCookie?.split("=")[0] ?? "ABSENT";

  await new Promise<void>((resolve) => {
    process.stdout.write(cookieName, () => resolve());
  });

  await server.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
