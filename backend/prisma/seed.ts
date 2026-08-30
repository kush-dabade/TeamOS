/**
 * Deterministic, idempotent local seed for evaluating TeamOS immediately
 * after a fresh clone (Commit 4 of the fresh-clone/developer-experience PR;
 * Commits 1-3 made the environment, test-env, and email-verification pieces
 * of that same acceptance bar work).
 *
 * Every entity is created through the real application services this
 * repository already ships - Better Auth for the user (via auth.api,
 * already the established pattern - see requireAuth.ts/realtime.auth.ts),
 * and, for everything else, src/modules/demo/demo-data-generator.ts's
 * generateWorkspaceData() - the same generator PR 5's public demo
 * provisioning service (src/modules/demo/demo.service.ts) calls to
 * populate a fresh visitor's workspace, so the two never drift into
 * maintaining separate "realistic sample data" content. Unlike
 * tests/setup/fixtures.ts's direct-Prisma fixtures (deliberately simple,
 * since test setup doesn't need realistic Activity history), this seed's
 * whole purpose is to look like genuinely-used product data, and the
 * Activity feed is a core, visible part of that - going through the real
 * services is what generates correct Activity rows for free, with no
 * separate hand-maintained Activity-shape logic to keep in sync.
 *
 * This file itself only owns identity: idempotently ensuring the one fixed
 * demo@teamos.local user/workspace exist, then handing off to the shared
 * generator. Idempotent by construction: every step looks up its entity by
 * a natural
 * key first (email, workspace/project slug, sprint name, task/comment
 * content within their small fixed set) and only calls the creating service
 * if it's missing - re-running `npm run seed` converges to the same state
 * instead of duplicating rows. This also means a seed run that fails
 * partway through is safe to simply re-run: already-created entities are
 * found and skipped, so the run resumes rather than duplicating what
 * already succeeded - no separate top-level transaction is needed for
 * that. Each individual entity-creation service already wraps its own
 * write (+ Activity row) in its own transaction (see e.g.
 * project.service.ts's createProject), which is the right transaction
 * boundary for this: one atomic unit per real action, exactly matching
 * what happens when a user performs that same action through the API.
 */
import "dotenv/config";

import { isLocalDevelopment } from "../src/config/security.config.js";
import { prisma } from "../src/lib/prisma.js";
import { auth } from "../src/lib/auth.js";
import { createWorkspace } from "../src/modules/workspace/workspace.service.js";
import { generateWorkspaceData } from "../src/modules/demo/demo-data-generator.js";

// Deliberately not a real person's email/domain - .local is reserved for
// exactly this (RFC 6761), and this exact address/password pair is meant to
// be published in Commit 5's README, so it must be obviously a local-only
// demo credential, never mistakable for a real account.
const DEMO_EMAIL = "demo@teamos.local";
const DEMO_NAME = "Demo User";
// Satisfies the frontend's registration complexity rule too (8+ chars,
// upper, lower, number - see frontend/src/features/auth/validation/register.ts)
// even though signing up here goes through Better Auth directly, not that
// form - so this remains a valid credential if anyone ever re-registers it
// through the real UI after intentionally deleting the seeded row.
const DEMO_PASSWORD = "TeamOSDemo123!";

const DEMO_WORKSPACE_NAME = "TeamOS Demo";
// Must match generateSlug(DEMO_WORKSPACE_NAME) (src/lib/slug.ts) - this is
// what createWorkspace would derive on its own, asserted explicitly here so
// the idempotency lookup below (by slug) stays correct if that name ever
// changes.
const DEMO_WORKSPACE_SLUG = "teamos-demo";

async function ensureDemoUser(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (existing) {
    if (!existing.emailVerified) {
      await prisma.user.update({ where: { id: existing.id }, data: { emailVerified: true } });
    }

    return existing.id;
  }

  // The real Better Auth sign-up flow (same auth.api.* pattern already
  // used elsewhere - see require-auth.ts's auth.api.getSession()) - not a
  // raw prisma.user.create(), so this account has a correctly-hashed
  // password and a real linked credential Account row, exactly like any
  // other TeamOS user, and can sign in through the actual login form.
  const result = await auth.api.signUpEmail({
    body: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });

  const userId = result.user.id;

  // databaseHooks.user.create.before (lib/auth.ts, Commit 3) already marks
  // this user verified - it's gated on the exact same isLocalDevelopment
  // check this script's own guard below requires to reach this point at
  // all. Set explicitly anyway: this script shouldn't silently depend on
  // that hook's continued existence to produce a usable demo account.
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });

  return userId;
}

async function ensureDemoWorkspace(ownerId: string) {
  const existing = await prisma.workspace.findUnique({
    where: { slug: DEMO_WORKSPACE_SLUG },
  });

  if (existing) {
    return existing;
  }

  const created = await createWorkspace({ name: DEMO_WORKSPACE_NAME, ownerId });

  return prisma.workspace.findUniqueOrThrow({ where: { id: created.id } });
}

async function main(): Promise<void> {
  // Reuses Commit 3's exact local-development signal (config/security.config.ts)
  // rather than a second environment check - `!isProduction` is
  // deliberately not used here either, for the identical reason Commit 3
  // avoided it: NODE_ENV=test must stay distinguishable from real local
  // development so this script can never fire as a side effect of running
  // the test suite. This is a hard stop, not a soft warning: the account
  // this creates has a publicly-documented (Commit 5) password, and running
  // this against any database that isn't a disposable local one would be a
  // real credential exposure.
  if (!isLocalDevelopment) {
    console.error(
      "Refusing to seed outside NODE_ENV=development. This script creates " +
        `a demo account (${DEMO_EMAIL}) with a password that will be ` +
        "published in the project's README - it must never run against " +
        "production or any real database.",
    );

    process.exit(1);
  }

  const userId = await ensureDemoUser();
  const workspace = await ensureDemoWorkspace(userId);

  await generateWorkspaceData(workspace.id, userId);

  console.log("Seed complete.");
  console.log(`  Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Workspace: ${DEMO_WORKSPACE_NAME} (${DEMO_WORKSPACE_SLUG})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();

    // Explicit exit, same as tests/setup/secure-cookie-production-check.ts
    // and dev-verification-bypass-check.ts: this script's import graph
    // pulls in lib/auth.ts, which opens ioredis connections (rate-limit
    // Redis, the email BullMQ queue) that never get closed on their own -
    // nothing here needs them kept alive once main() has finished, but
    // Node won't exit on its own while they're open.
    process.exit(process.exitCode ?? 0);
  });
