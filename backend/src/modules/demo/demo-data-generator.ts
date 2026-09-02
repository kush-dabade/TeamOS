/**
 * Shared workspace-data generator, extracted from prisma/seed.ts (the
 * fresh-clone local dev seed) so the same realistic project/task/sprint/
 * comment content can be produced for a second caller: the public demo
 * provisioning service (demo.service.ts). Both callers create their own
 * user/workspace first (identity provisioning differs between the two -
 * one is a single fixed idempotent local account, the other a fresh
 * account per visitor) and then call generateWorkspaceData(workspaceId,
 * ownerId) here to populate it.
 *
 * Every entity is created through the real application services this
 * repository already ships (project/task/sprint/comment service
 * functions), never raw Prisma inserts - the whole point is realistic
 * data, and the Activity feed that comes along with it is a core part of
 * that; going through the real services generates correct Activity rows
 * for free, with no separate hand-maintained Activity-shape logic to keep
 * in sync.
 *
 * The `ensure*` helpers are idempotent (look up by natural key, only
 * create if missing) because prisma/seed.ts's local dev seed must stay
 * safely re-runnable. The demo provisioning caller always passes a
 * brand-new, never-before-seen workspaceId, so every lookup there is a
 * guaranteed no-op miss - harmless, and not worth a second, non-idempotent
 * code path just to save one lookup per entity.
 *
 * This is the single, permanent source of demo workspace content for the
 * whole application - not a placeholder to be replaced or forked once the
 * dataset grows richer. The two callers are meant to keep differing only
 * in identity/lifecycle provisioning (a fixed idempotent local account vs.
 * a fresh throwaway one per visitor); the content this function produces
 * should stay identical between them. Do not introduce a second,
 * lighter-weight generator for either caller - grow this one in place.
 */
import { prisma } from "../../lib/prisma.js";
import { createProject, updateProject } from "../project/project.service.js";
import type { ProjectStatus } from "../project/project.types.js";
import { createSprint, startSprint } from "../sprint/sprint.service.js";
import { assignTaskToSprint } from "../sprint-task/sprint-task.service.js";
import { createTask, updateTask } from "../task/task.service.js";
import type { TaskPriority, TaskStatus } from "../task/task.types.js";
import { createComment } from "../comments/comments.service.js";

interface ProjectSeed {
  name: string;
  slug: string;
  description: string;
  // Narrower than the full ProjectStatus type (which also includes
  // ARCHIVED) - updateProject's own input type doesn't accept ARCHIVED
  // (archiving is a separate, dedicated endpoint/service - archiveProject),
  // and an archived project would also block every subsequent task/sprint
  // creation this generator does against it, so it's excluded here rather
  // than widened to match.
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

/**
 * Populates an already-created, empty workspace with realistic product
 * data - projects, tasks, sprints, and comments, spanning a believable
 * range of statuses/priorities/history. `ownerId` must already be a
 * member of `workspaceId` (both callers create the owner's
 * WorkspaceMember row before calling this).
 *
 * Every entity is created through the real project/task/sprint/comment
 * services as `ownerId`, exactly as documented above the imports. Content
 * attributed to other workspace members (once this function is extended
 * to seed a full team) should be created the same way, as those members'
 * own real actor ids - not backfilled as `ownerId` acting on their
 * behalf.
 */
export async function generateWorkspaceData(workspaceId: string, ownerId: string): Promise<void> {
  const websiteProject = await ensureProject(workspaceId, ownerId, {
    name: "Website Redesign",
    slug: "website-redesign",
    description: "Redesigning the marketing site ahead of the Q1 launch.",
    status: "ACTIVE",
  });

  const mobileProject = await ensureProject(workspaceId, ownerId, {
    name: "Mobile App",
    slug: "mobile-app",
    description: "Native iOS/Android companion app for TeamOS.",
    status: "PLANNED",
  });

  const launchProject = await ensureProject(workspaceId, ownerId, {
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
    ).map((spec) => ensureTask(workspaceId, websiteProject.id, ownerId, spec)),
  );

  const sprint = await ensureSprint(
    workspaceId,
    websiteProject.id,
    ownerId,
    "Sprint 1 — Homepage Launch",
    "Ship the redesigned homepage end to end.",
  );

  for (const task of websiteTasks.slice(0, 3)) {
    await ensureTaskInSprint(ownerId, sprint.id, task.id);
  }

  await ensureSprintStarted(ownerId, sprint.id);

  await ensureComment(
    ownerId,
    websiteTasks[1]!.id,
    "Nav is functional on desktop - working through mobile breakpoints next.",
  );

  await ensureComment(
    ownerId,
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
    ).map((spec) => ensureTask(workspaceId, mobileProject.id, ownerId, spec)),
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
    ).map((spec) => ensureTask(workspaceId, launchProject.id, ownerId, spec)),
  );
}
