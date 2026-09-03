import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

import { resetDatabase } from "./reset-database.js";

const execFileAsync = promisify(execFile);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SEED_SCRIPT = path.join(backendRoot, "prisma/seed.ts");

const DEMO_EMAIL = "demo@teamos.local";
const DEMO_NAME = "Alex Rivera";
const DEMO_PASSWORD = "TeamOSDemo123!";
const DEMO_WORKSPACE_SLUG = "acme-inc";

/**
 * Spawns the real backend/prisma/seed.ts, the exact command `npm run seed`
 * runs, as a genuinely separate process - same rationale as
 * dev-verification-bypass-check.ts: config/security.config.ts's
 * isLocalDevelopment is a module-level const frozen at first import.
 * Inherits this test process's own env (including DATABASE_URL, already
 * pointed at teamos_test by tests/setup/test-env.ts) and overrides only
 * NODE_ENV, so the seed writes into the exact same disposable database
 * every other test in this suite uses and resetDatabase() below cleans up.
 */
function runSeed(nodeEnv: string) {
  return execFileAsync("npx", ["tsx", SEED_SCRIPT], {
    cwd: backendRoot,
    env: { ...process.env, NODE_ENV: nodeEnv },
  });
}

/**
 * Commit 4: backend/prisma/seed.ts. Covers the three things that matter for
 * a fresh-clone evaluator - the seed actually produces a usable, populated
 * workspace; re-running it (npm run seed twice, or a re-run after a partial
 * failure) doesn't duplicate anything; and it's impossible to run outside
 * local development, including under this suite's own NODE_ENV=test - the
 * same isLocalDevelopment distinction Commit 3's bypass tests protect.
 */
describe("deterministic seed (Commit 4)", () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it("creates the demo user, team, workspace, projects, tasks, sprints, comments, and attachments", async () => {
    await runSeed("development");

    const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

    expect(user).toBeTruthy();
    expect(user!.emailVerified).toBe(true);
    expect(user!.name).toBe(DEMO_NAME);

    const workspace = await prisma.workspace.findUnique({
      where: { slug: DEMO_WORKSPACE_SLUG },
    });

    expect(workspace).toBeTruthy();
    expect(workspace!.name).toBe("Acme Inc.");
    expect(workspace!.ownerId).toBe(user!.id);

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace!.id, userId: user!.id } },
    });

    expect(membership).toBeTruthy();
    expect(membership!.role).toBe("OWNER");

    // The full Acme Inc. team (Commit 2): the owner plus 5 real invited/
    // accepted members - not asserting individual names/roles here, just
    // that the team-building side of the seed converged.
    const memberCount = await prisma.workspaceMember.count({ where: { workspaceId: workspace!.id } });

    expect(memberCount).toBe(6);

    // One believable next-hire invitation, deliberately left pending
    // (Commit 2) - not accepted, not a second pending invite.
    const invitations = await prisma.workspaceInvitation.findMany({
      where: { workspaceId: workspace!.id },
    });

    expect(invitations).toHaveLength(6);
    expect(invitations.filter((invitation) => invitation.status === "PENDING")).toHaveLength(1);

    const projects = await prisma.project.findMany({
      where: { workspaceId: workspace!.id },
      orderBy: { slug: "asc" },
    });

    expect(projects.map((project) => ({ slug: project.slug, status: project.status }))).toEqual([
      { slug: "internal-platform", status: "PLANNED" },
      { slug: "mobile-app", status: "ACTIVE" },
      { slug: "product-launch", status: "COMPLETED" },
      { slug: "website-redesign", status: "ACTIVE" },
    ]);

    const tasks = await prisma.task.findMany({ where: { workspaceId: workspace!.id } });

    expect(tasks).toHaveLength(21);

    // Commit 3's full sprint lifecycle: one of each state, not asserting
    // exact per-sprint task counts (that's the seed's content, not its
    // contract) - just that all three lifecycle states are genuinely
    // reachable through the real service calls that produced them.
    const sprints = await prisma.sprint.findMany({ where: { workspaceId: workspace!.id } });

    expect(sprints).toHaveLength(3);
    expect(sprints.map((sprint) => sprint.status).sort()).toEqual(["ACTIVE", "COMPLETED", "PLANNED"]);

    // Commit 4: multi-author collaboration, not the original single-owner
    // pair.
    const comments = await prisma.comment.count({ where: { workspaceId: workspace!.id } });

    expect(comments).toBe(8);

    const attachments = await prisma.attachment.count({ where: { workspaceId: workspace!.id } });

    expect(attachments).toBe(3);

    // The whole point of using the real project/task/sprint/comment/
    // attachment services (not raw Prisma inserts) rather than mirroring
    // tests/setup/fixtures.ts's simpler direct-insert convention: a
    // populated Activity feed comes for free, with no hand-maintained
    // Activity-shape logic in the seed itself. Not pinning an exact count -
    // notifications (also service side effects) are asynchronous through
    // BullMQ and this test never starts a worker, so only Activity (a
    // synchronous side effect of the same calls) is asserted here.
    const activities = await prisma.activity.count({ where: { workspaceId: workspace!.id } });

    expect(activities).toBeGreaterThan(0);
  });

  it(
    "does not duplicate any seeded record when run a second time",
    async () => {
      await runSeed("development");

      const countsAfterFirstRun = await Promise.all([
        prisma.user.count({ where: { email: DEMO_EMAIL } }),
        prisma.workspace.count(),
        prisma.workspaceMember.count(),
        prisma.workspaceInvitation.count(),
        prisma.project.count(),
        prisma.task.count(),
        prisma.sprint.count(),
        prisma.comment.count(),
        prisma.attachment.count(),
        prisma.activity.count(),
      ]);

      await runSeed("development");

      const countsAfterSecondRun = await Promise.all([
        prisma.user.count({ where: { email: DEMO_EMAIL } }),
        prisma.workspace.count(),
        prisma.workspaceMember.count(),
        prisma.workspaceInvitation.count(),
        prisma.project.count(),
        prisma.task.count(),
        prisma.sprint.count(),
        prisma.comment.count(),
        prisma.attachment.count(),
        prisma.activity.count(),
      ]);

      expect(countsAfterSecondRun).toEqual(countsAfterFirstRun);
    },
    // Two full sequential `npm run seed` subprocess runs against the
    // current canonical dataset (6 members, 4 projects, 21 tasks, 3
    // sprints, comments, and attachments, all through the real service
    // layer, twice) comfortably exceed vitest.config.ts's default 15s
    // testTimeout - same rationale as tests/demo/rate-limit.test.ts's own
    // 30_000 override.
    30_000,
  );

  it("refuses to run under NODE_ENV=production, leaving the database untouched", async () => {
    await expect(runSeed("production")).rejects.toThrow();

    const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

    expect(user).toBeNull();
  });

  it("refuses to run under NODE_ENV=test (this suite's own value), same isLocalDevelopment boundary as Commit 3", async () => {
    await expect(runSeed("test")).rejects.toThrow();

    const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

    expect(user).toBeNull();
  });

  it("seeds a user who can sign in through the real Better Auth flow, not a fabricated session", async () => {
    await runSeed("development");

    const signInResponse = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const setCookie = signInResponse.headers["set-cookie"] as unknown as string[] | undefined;

    expect(setCookie).toBeTruthy();
    expect(setCookie!.length).toBeGreaterThan(0);

    const cookie = setCookie!.map((entry) => entry.split(";")[0]).join("; ");

    const workspacesResponse = await request(app)
      .get("/api/v1/workspaces")
      .set("Cookie", cookie)
      .expect(200);

    expect(workspacesResponse.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: DEMO_WORKSPACE_SLUG })]),
    );
  });
});
