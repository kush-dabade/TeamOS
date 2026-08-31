import { randomBytes } from "node:crypto";

import { auth } from "../../lib/auth.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { createWorkspace } from "../workspace/workspace.service.js";

import { DEMO_SESSION_TTL_HOURS, generateDemoEmail } from "./demo.constants.js";
import { generateWorkspaceData } from "./demo-data-generator.js";

export interface DemoSessionResult {
  /**
   * The Set-Cookie header(s) from Better Auth's own real sign-in call -
   * the controller copies these onto the actual HTTP response. Never a
   * fabricated cookie/token: this is auth.api.signInEmail's own supported
   * `returnHeaders` output (see this function's own comment below).
   */
  headers: Headers;
  expiresAt: Date;
}

// 24 random bytes (hex-encoded, so 48 characters) - never displayed,
// stored, or returned to the browser; only used once, internally, to
// authenticate the immediate signInEmail call below. Comfortably clears
// Better Auth's own minimum password length (8) with wide margin, so no
// separate length check is needed.
function generateDemoPassword(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Provisions one isolated, real TeamOS tenant for an anonymous visitor:
 * a real Better Auth user, a real workspace they own, realistic seeded
 * data, and a real authenticated session - exactly what a human doing
 * sign-up -> create-workspace -> (seed data) would end up with, just
 * automated into one call.
 *
 * Session creation (auth.api.signInEmail) is deliberately the LAST step.
 * Every step before it can throw (Better Auth signup, the Prisma flag
 * update, workspace creation, data generation) - if any of them do, no
 * cookie has been issued for this identity yet, so it's simply inert:
 * nobody holds its randomly-generated password, nothing can authenticate
 * as it, and it wasn't returned to any caller. It's picked up and removed
 * by the exact same TTL-based cleanup sweep as a normal expired demo
 * session (see demo-cleanup.service.ts) - no separate "provisioning
 * failed" rollback/recovery path is needed. This also means
 * isDemo/demoExpiresAt are set as early as possible (right after the user
 * row exists, before workspace/data provisioning), not at the end: an
 * orphaned user-only row must be just as eligible for cleanup as a fully
 * provisioned one.
 */
export async function provisionDemoSession(): Promise<DemoSessionResult> {
  const email = generateDemoEmail();
  const password = generateDemoPassword();

  // Same three-step shape as tests/setup/fixtures.ts's signUpTestUser and
  // prisma/seed.ts's ensureDemoUser: sign up (requireEmailVerification:
  // true means this alone never returns a session - see lib/auth.ts),
  // then mark verified directly via Prisma, then sign in for a real
  // session. Deliberately NOT gated on/reusing isLocalDevelopment's
  // create.before hook (lib/auth.ts) - that hook is local-development-only
  // by design, and the public demo must work in every environment,
  // production included.
  const signUpResult = await auth.api.signUpEmail({
    body: { name: "Guest", email, password },
  });

  const userId = signUpResult.user.id;
  const expiresAt = new Date(Date.now() + DEMO_SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      isDemo: true,
      demoExpiresAt: expiresAt,
    },
  });

  const workspace = await createWorkspace({ name: "My TeamOS Demo", ownerId: userId });

  await generateWorkspaceData(workspace.id, userId);

  // Better Auth's own supported mechanism for getting a real session's
  // Set-Cookie header(s) back from a direct auth.api.* call instead of an
  // HTTP request/response cycle - verified against the installed
  // better-auth's api/to-auth-endpoints.mjs: passing `returnHeaders: true`
  // (with neither `asResponse` nor a `request`) returns
  // `{ headers, response }`, where `headers` is a real Headers instance
  // built from the same ctx.setCookie/setSessionCookie calls the normal
  // HTTP sign-in path uses. Not a manufactured token.
  const signInResult = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });

  logger.info(
    { userId, workspaceId: workspace.id, expiresAt: expiresAt.toISOString() },
    "Provisioned public demo session",
  );

  return { headers: signInResult.headers, expiresAt };
}
