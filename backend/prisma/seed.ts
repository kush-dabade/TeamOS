/**
 * Deterministic, idempotent local seed for evaluating TeamOS immediately
 * after a fresh clone (Commit 4 of the fresh-clone/developer-experience PR;
 * Commits 1-3 made the environment, test-env, and email-verification pieces
 * of that same acceptance bar work).
 *
 * Every entity is created through the real application services this
 * repository already ships - Better Auth for the user (via auth.api,
 * already the established pattern - see requireAuth.ts/realtime.auth.ts),
 * and workspace/project/task/sprint/comment service functions for
 * everything else - rather than raw Prisma inserts. Unlike
 * tests/setup/fixtures.ts's direct-Prisma fixtures (deliberately simple,
 * since test setup doesn't need realistic Activity history), this seed's
 * whole purpose is to look like genuinely-used product data, and the
 * Activity feed is a core, visible part of that - going through the real
 * services is what generates correct Activity rows for free, with no
 * separate hand-maintained Activity-shape logic to keep in sync.
 *
 * Idempotent by construction: every step looks up its entity by a natural
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
import { createProject, updateProject } from "../src/modules/project/project.service.js";
import { createTask, updateTask } from "../src/modules/task/task.service.js";
import { createSprint, startSprint } from "../src/modules/sprint/sprint.service.js";
import { assignTaskToSprint } from "../src/modules/sprint-task/sprint-task.service.js";
import { createComment } from "../src/modules/comments/comments.service.js";
import type { ProjectStatus } from "../src/modules/project/project.types.js";
import type { TaskPriority, TaskStatus } from "../src/modules/task/task.types.js";

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

interface ProjectSeed {
  name: string;
  slug: string;
  description: string;
  // Narrower than the full ProjectStatus type (which also includes
  // ARCHIVED) - updateProject's own input type doesn't accept ARCHIVED
  // (archiving is a separate, dedicated endpoint/service - archiveProject),
  // and an archived project would also block every subsequent task/sprint
  // creation this seed does against it, so it's excluded here rather than
  // widened to match.
  status: Exclude<ProjectStatus, "ARCHIVED">;
}

async function ensureProject(workspaceId: string, ownerId: string, spec: ProjectSeed) {
  const existing = await prisma.project.findUnique({
    where: { workspaceId_slug: { workspaceId, slug: spec.slug } },
  });

  if (existing) {
    return existing;
  }

  // createProject always starts a project at the schema default (PLANNED) -
  // there's no status field on CreateProjectData, matching how a real user
  // can only set status via a separate update once the project exists.
  // updateProject below mirrors that same two-step for the seed.
  const created = await createProject(ownerId, {
    workspaceId,
    ownerId,
    name: spec.name,
    description: spec.description,
  });

  if (spec.status !== "PLANNED") {
    await updateProject(ownerId, created.id, { status: spec.status });
  }

  return prisma.project.findUniqueOrThrow({ where: { id: created.id } });
}

interface TaskSeed {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assign: boolean;
  dueDateOffsetDays?: number;
}

function offsetDate(days: number): Date {
  const date = new Date();

  date.setUTCDate(date.getUTCDate() + days);

  return date;
}

async function ensureTask(
  workspaceId: string,
  projectId: string,
  actorId: string,
  spec: TaskSeed,
) {
  const existing = await prisma.task.findFirst({
    where: { workspaceId, projectId, title: spec.title },
  });

  if (existing) {
    return existing;
  }

  // status isn't settable at creation (CreateTaskData has no status field -
  // every task starts TODO, matching real user behavior) - updateTask below
  // is the same second step a real user takes to move it off TODO.
  const created = await createTask(actorId, {
    projectId,
    title: spec.title,
    description: spec.description,
    priority: spec.priority,
    ...(spec.assign && { assigneeId: actorId }),
    ...(spec.dueDateOffsetDays !== undefined && {
      dueDate: offsetDate(spec.dueDateOffsetDays),
    }),
  });

  if (spec.status !== "TODO") {
    await updateTask(actorId, created.id, { status: spec.status });
  }

  return prisma.task.findUniqueOrThrow({ where: { id: created.id } });
}

async function ensureSprint(
  workspaceId: string,
  projectId: string,
  actorId: string,
  name: string,
  goal: string,
) {
  const existing = await prisma.sprint.findUnique({
    where: { projectId_name: { projectId, name } },
  });

  if (existing) {
    return existing;
  }

  const created = await createSprint(actorId, { projectId, name, goal });

  return prisma.sprint.findUniqueOrThrow({ where: { id: created.id } });
}

async function ensureTaskInSprint(actorId: string, sprintId: string, taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  if (task.sprintId === sprintId) {
    return;
  }

  await assignTaskToSprint(actorId, sprintId, taskId);
}

async function ensureSprintStarted(actorId: string, sprintId: string) {
  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });

  if (sprint.status !== "PLANNED") {
    return;
  }

  await startSprint(actorId, sprintId);
}

async function ensureComment(actorId: string, taskId: string, content: string) {
  const existing = await prisma.comment.findFirst({ where: { taskId, content } });

  if (existing) {
    return existing;
  }

  return createComment(actorId, { taskId, content });
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

  const websiteProject = await ensureProject(workspace.id, userId, {
    name: "Website Redesign",
    slug: "website-redesign",
    description: "Redesigning the marketing site ahead of the Q1 launch.",
    status: "ACTIVE",
  });

  const mobileProject = await ensureProject(workspace.id, userId, {
    name: "Mobile App",
    slug: "mobile-app",
    description: "Native iOS/Android companion app for TeamOS.",
    status: "PLANNED",
  });

  const launchProject = await ensureProject(workspace.id, userId, {
    name: "Product Launch",
    slug: "product-launch",
    description: "Go-to-market coordination for the v1 release.",
    status: "COMPLETED",
  });

  const websiteTasks = await Promise.all(
    (
      [
        {
          title: "Design new homepage mockups",
          description: "High-fidelity mockups for the redesigned homepage hero and nav.",
          status: "DONE",
          priority: "HIGH",
          assign: true,
          dueDateOffsetDays: -5,
        },
        {
          title: "Implement responsive navigation",
          description: "Build the new nav bar to match the approved mockups, mobile included.",
          status: "IN_PROGRESS",
          priority: "HIGH",
          assign: true,
          dueDateOffsetDays: 3,
        },
        {
          title: "QA cross-browser testing",
          description: "Verify the redesigned pages render correctly across major browsers.",
          status: "REVIEW",
          priority: "MEDIUM",
          assign: true,
          dueDateOffsetDays: 5,
        },
        {
          title: "Write copy for pricing page",
          description: "Draft final pricing page copy for review.",
          status: "TODO",
          priority: "MEDIUM",
          assign: false,
          dueDateOffsetDays: 10,
        },
        {
          title: "Set up analytics tracking",
          description: "Wire up event tracking for the new marketing pages.",
          status: "TODO",
          priority: "LOW",
          assign: false,
        },
      ] satisfies TaskSeed[]
    ).map((spec) => ensureTask(workspace.id, websiteProject.id, userId, spec)),
  );

  const sprint = await ensureSprint(
    workspace.id,
    websiteProject.id,
    userId,
    "Sprint 1 — Homepage Launch",
    "Ship the redesigned homepage end to end.",
  );

  for (const task of websiteTasks.slice(0, 3)) {
    await ensureTaskInSprint(userId, sprint.id, task.id);
  }

  await ensureSprintStarted(userId, sprint.id);

  await ensureComment(
    userId,
    websiteTasks[1]!.id,
    "Nav is functional on desktop - working through mobile breakpoints next.",
  );

  await ensureComment(
    userId,
    websiteTasks[2]!.id,
    "Found a layout issue in Safari, filing a follow-up task once triaged.",
  );

  await Promise.all(
    (
      [
        {
          title: "Define MVP feature set",
          description: "Scope the feature set for the first mobile app release.",
          status: "TODO",
          priority: "HIGH",
          assign: true,
          dueDateOffsetDays: 14,
        },
        {
          title: "Choose cross-platform framework",
          description: "Evaluate React Native vs. Flutter for the mobile app.",
          status: "TODO",
          priority: "MEDIUM",
          assign: false,
        },
      ] satisfies TaskSeed[]
    ).map((spec) => ensureTask(workspace.id, mobileProject.id, userId, spec)),
  );

  await Promise.all(
    (
      [
        {
          title: "Finalize launch checklist",
          description: "Confirm every launch-day task is complete and owned.",
          status: "DONE",
          priority: "HIGH",
          assign: true,
          dueDateOffsetDays: -14,
        },
        {
          title: "Send press release",
          description: "Distribute the launch press release to the media list.",
          status: "DONE",
          priority: "MEDIUM",
          assign: true,
          dueDateOffsetDays: -12,
        },
      ] satisfies TaskSeed[]
    ).map((spec) => ensureTask(workspace.id, launchProject.id, userId, spec)),
  );

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
