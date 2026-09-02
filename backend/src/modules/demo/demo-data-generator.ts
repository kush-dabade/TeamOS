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
import { randomBytes, randomUUID } from "node:crypto";

import { prisma } from "../../lib/prisma.js";
import { auth } from "../../lib/auth.js";
import { WorkspaceRole } from "../../generated/prisma/enums.js";
import { createProject, updateProject } from "../project/project.service.js";
import type { ProjectStatus } from "../project/project.types.js";
import { createSprint, startSprint, completeSprint } from "../sprint/sprint.service.js";
import { assignTaskToSprint } from "../sprint-task/sprint-task.service.js";
import { createTask, updateTask } from "../task/task.service.js";
import type { TaskPriority, TaskStatus } from "../task/task.types.js";
import { createComment } from "../comments/comments.service.js";
import { createInvitation, acceptInvitation } from "../invitation/invitation.service.js";

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

// actorId (who performs the create/status-transition calls) and
// projectOwnerId (the resulting Project.ownerId) are deliberately separate
// params - createProject only requires the actor to be OWNER/ADMIN
// (project.service.ts), not that they end up as the project's owner, so a
// project can legitimately be filed by one person and owned by another
// (e.g. Alex setting Sofia as the owner of a design-led initiative), the
// same way a real workspace admin can do this today.
async function ensureProject(
  workspaceId: string,
  actorId: string,
  projectOwnerId: string,
  spec: ProjectSeed,
) {
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
  const created = await createProject(actorId, {
    workspaceId,
    ownerId: projectOwnerId,
    name: spec.name,
    description: spec.description,
  });

  if (spec.status !== "PLANNED") {
    await updateProject(actorId, created.id, { status: spec.status });
  }

  return prisma.project.findUniqueOrThrow({ where: { id: created.id } });
}

interface TaskSeed {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  // undefined means genuinely unassigned - no longer derived from whoever
  // happens to be the acting creator, since Commit 3 attributes tasks to
  // whichever team member the work actually belongs to.
  assigneeId?: string;
  dueDateOffsetDays?: number;
}

function offsetDate(days: number): Date {
  const date = new Date();

  date.setUTCDate(date.getUTCDate() + days);

  return date;
}

// Who files a task, when the spec itself doesn't say: the assignee, for a
// task someone is picking up themselves (the common real-world case - you
// file your own ticket), falling back to filerId (typically the
// project's lead/PM) for the deliberately-unassigned tasks, matching who'd
// realistically open a ticket nobody's claimed yet.
function taskCreator(spec: TaskSeed, filerId: string): string {
  return spec.assigneeId ?? filerId;
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
    ...(spec.assigneeId !== undefined && { assigneeId: spec.assigneeId }),
    ...(spec.dueDateOffsetDays !== undefined && {
      dueDate: offsetDate(spec.dueDateOffsetDays),
    }),
  });

  if (spec.status !== "TODO") {
    await updateTask(actorId, created.id, { status: spec.status });
  }

  return prisma.task.findUniqueOrThrow({ where: { id: created.id } });
}

interface SprintSeed {
  name: string;
  goal: string;
  startDate?: Date;
  endDate?: Date;
}

async function ensureSprint(
  workspaceId: string,
  projectId: string,
  actorId: string,
  spec: SprintSeed,
) {
  const existing = await prisma.sprint.findUnique({
    where: { projectId_name: { projectId, name: spec.name } },
  });

  if (existing) {
    return existing;
  }

  const created = await createSprint(actorId, {
    projectId,
    name: spec.name,
    goal: spec.goal,
    ...(spec.startDate !== undefined && { startDate: spec.startDate }),
    ...(spec.endDate !== undefined && { endDate: spec.endDate }),
  });

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

async function ensureSprintCompleted(actorId: string, sprintId: string) {
  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });

  if (sprint.status !== "ACTIVE") {
    return;
  }

  await completeSprint(actorId, sprintId);
}

async function ensureComment(actorId: string, taskId: string, content: string) {
  const existing = await prisma.comment.findFirst({ where: { taskId, content } });

  if (existing) {
    return existing;
  }

  return createComment(actorId, { taskId, content });
}

interface TeamMemberSpec {
  name: string;
  role: Exclude<WorkspaceRole, "OWNER" | "GUEST">;
  emailLocalPart: string;
}

interface AcmeTeamMembers {
  engineeringLead: string;
  backendEngineer: string;
  frontendEngineer: string;
  designer: string;
  productManager: string;
}

// Reserved for exactly this (RFC 6761) - never resolves to, or collides
// with, a real mailbox. A distinct domain from the existing teamos.local
// convention (prisma/seed.ts's DEMO_EMAIL, demo.constants.ts's generated
// /try owner emails): teamos.local is the platform's own scaffolding
// identity (the documented login, anonymous /try owners); acme.local is
// reserved for the fictional company's own people.
const ACME_TEAM_DOMAIN = "acme.local";

function acmeTeamEmail(localPart: string): string {
  return `${localPart}@${ACME_TEAM_DOMAIN}`;
}

// Nobody signs in as these accounts - only the documented demo@teamos.local
// login is meant to be usable - so a random password (never displayed,
// stored, or needed again after creation) is correct here, the same
// reasoning demo.service.ts's own generateDemoPassword() already uses for
// the /try owner.
function randomLocalPassword(): string {
  return randomBytes(24).toString("hex");
}

const ACME_ENGINEERING_LEAD: TeamMemberSpec = {
  name: "Maya Chen",
  role: WorkspaceRole.ADMIN,
  emailLocalPart: "maya.chen",
};

const ACME_BACKEND_ENGINEER: TeamMemberSpec = {
  name: "Daniel Brooks",
  role: WorkspaceRole.MEMBER,
  emailLocalPart: "daniel.brooks",
};

const ACME_FRONTEND_ENGINEER: TeamMemberSpec = {
  name: "Priya Shah",
  role: WorkspaceRole.MEMBER,
  emailLocalPart: "priya.shah",
};

const ACME_DESIGNER: TeamMemberSpec = {
  name: "Sofia Martinez",
  role: WorkspaceRole.MEMBER,
  emailLocalPart: "sofia.martinez",
};

const ACME_PRODUCT_MANAGER: TeamMemberSpec = {
  name: "Ethan Williams",
  role: WorkspaceRole.MEMBER,
  emailLocalPart: "ethan.williams",
};

// The team's next believable hire - deliberately left PENDING, never
// accepted, so the Workspace Settings / Invitations UI has something real
// to show. Not a new InvitationStatus value - the existing PENDING state,
// simply never advanced.
const ACME_PENDING_INVITEE: TeamMemberSpec = {
  name: "Jordan Kim",
  role: WorkspaceRole.MEMBER,
  emailLocalPart: "jordan.kim",
};

/**
 * Ensures one fixed-identity Acme Inc. team member exists, is a real member
 * of `workspaceId`, and got there through the real invitation -> acceptance
 * flow - exactly the path a genuine new hire takes, not a shortcut insert.
 * Idempotent by construction: an existing user is reused by email (never
 * re-signed-up), and a user who is already a member is returned as-is
 * rather than re-invited - createInvitation() would otherwise reject a
 * second invite to an existing member outright.
 */
async function ensurePermanentTeamMember(
  workspaceId: string,
  inviterId: string,
  spec: TeamMemberSpec,
): Promise<string> {
  const email = acmeTeamEmail(spec.emailLocalPart);
  const existingUser = await prisma.user.findUnique({ where: { email } });

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const signUpResult = await auth.api.signUpEmail({
      body: { name: spec.name, email, password: randomLocalPassword() },
    });

    userId = signUpResult.user.id;

    await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
  }

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (existingMembership) {
    return userId;
  }

  const invitation = await createInvitation({
    workspaceId,
    email,
    role: spec.role,
    invitedById: inviterId,
  });

  await acceptInvitation(invitation.id, userId, email);

  return userId;
}

async function ensurePermanentPendingInvitation(
  workspaceId: string,
  inviterId: string,
): Promise<void> {
  const email = acmeTeamEmail(ACME_PENDING_INVITEE.emailLocalPart);

  const existing = await prisma.workspaceInvitation.findFirst({
    where: { workspaceId, email, status: "PENDING" },
  });

  if (existing) {
    return;
  }

  await createInvitation({
    workspaceId,
    email,
    role: ACME_PENDING_INVITEE.role,
    invitedById: inviterId,
  });
}

/**
 * The permanent local seed's team: fixed named identities, reused across
 * every rerun (looked up by email), added through the real invitation ->
 * acceptance flow. `ownerId` - the OWNER, never isDemo for this caller -
 * invites the engineering lead as ADMIN; the engineering lead, now a real
 * ADMIN member rather than the owner, invites the rest, so the team's own
 * membership history isn't single-actor. One further invitation (a
 * believable next hire) is left PENDING deliberately.
 */
async function ensurePermanentAcmeTeam(
  workspaceId: string,
  ownerId: string,
): Promise<AcmeTeamMembers> {
  const engineeringLead = await ensurePermanentTeamMember(workspaceId, ownerId, ACME_ENGINEERING_LEAD);

  const [backendEngineer, frontendEngineer, designer, productManager] = await Promise.all([
    ensurePermanentTeamMember(workspaceId, engineeringLead, ACME_BACKEND_ENGINEER),
    ensurePermanentTeamMember(workspaceId, engineeringLead, ACME_FRONTEND_ENGINEER),
    ensurePermanentTeamMember(workspaceId, engineeringLead, ACME_DESIGNER),
    ensurePermanentTeamMember(workspaceId, engineeringLead, ACME_PRODUCT_MANAGER),
  ]);

  await ensurePermanentPendingInvitation(workspaceId, engineeringLead);

  return { engineeringLead, backendEngineer, frontendEngineer, designer, productManager };
}

// Same acme.local convention as the permanent team, tagged with a short
// random suffix - plus-addressing is standard, valid email syntax, and
// keeps the domain (and therefore the "this person belongs to Acme Inc."
// reading) consistent with the permanent seed's fixed identities. Never
// looked up by natural key like acmeTeamEmail() - see
// ensureEphemeralAcmeTeam's docstring for why a fresh /try workspace needs
// a fresh account every time rather than reusing one.
function ephemeralAcmeTeamEmail(localPart: string): string {
  return `${localPart}+${randomUUID().slice(0, 8)}@${ACME_TEAM_DOMAIN}`;
}

/**
 * Creates one throwaway Acme Inc.-identity team member for a single /try
 * session and adds them directly as a WorkspaceMember of `workspaceId` -
 * the same direct insert workspace.service.ts's createWorkspace already
 * performs for the OWNER's own membership row, not a raw-Prisma shortcut
 * invented for this generator.
 *
 * Deliberately NOT routed through the real invitation -> acceptance flow
 * the permanent seed uses: createInvitation() unconditionally forbids
 * isDemo actors from sending invitations (invitation.service.ts) - a
 * deliberate anti-abuse control (an anonymous, free-to-create demo session
 * must never be able to send real invitation email to an arbitrary address
 * through the real pipeline), not an oversight to work around. Every
 * member of a /try workspace, this teammate included, must stay isDemo so
 * the existing TTL cleanup sweep can find and remove them - so no member of
 * a /try workspace can ever be a valid (non-demo) inviter, regardless of
 * whether these teammates are shared or freshly created per session. The
 * invitation flow is therefore structurally unusable here; this direct
 * membership insert is the smallest correct alternative, not a shortcut
 * chosen for convenience.
 *
 * Consequence, accepted deliberately: unlike the permanent seed's team,
 * this teammate's arrival produces no USER_INVITED/INVITATION_ACCEPTED
 * Activity - Activity is never fabricated directly, and there is no real
 * invitation event here to record.
 */
async function createEphemeralTeamMember(
  workspaceId: string,
  demoExpiresAt: Date | null,
  spec: TeamMemberSpec,
): Promise<string> {
  const signUpResult = await auth.api.signUpEmail({
    body: {
      name: spec.name,
      email: ephemeralAcmeTeamEmail(spec.emailLocalPart),
      password: randomLocalPassword(),
    },
  });

  const userId = signUpResult.user.id;

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, isDemo: true, demoExpiresAt },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId, userId, role: spec.role },
  });

  return userId;
}

/**
 * The /try flow's team: fresh throwaway identities created on every call,
 * never looked up by natural key. Safe because the caller (demo.service.ts)
 * always passes a brand-new, never-before-seen workspaceId - see this
 * file's header comment - so there is nothing to deduplicate against and no
 * risk of this ever running twice for the same workspace.
 */
async function ensureEphemeralAcmeTeam(
  workspaceId: string,
  demoExpiresAt: Date | null,
): Promise<AcmeTeamMembers> {
  const [engineeringLead, backendEngineer, frontendEngineer, designer, productManager] =
    await Promise.all([
      createEphemeralTeamMember(workspaceId, demoExpiresAt, ACME_ENGINEERING_LEAD),
      createEphemeralTeamMember(workspaceId, demoExpiresAt, ACME_BACKEND_ENGINEER),
      createEphemeralTeamMember(workspaceId, demoExpiresAt, ACME_FRONTEND_ENGINEER),
      createEphemeralTeamMember(workspaceId, demoExpiresAt, ACME_DESIGNER),
      createEphemeralTeamMember(workspaceId, demoExpiresAt, ACME_PRODUCT_MANAGER),
    ]);

  return { engineeringLead, backendEngineer, frontendEngineer, designer, productManager };
}

/**
 * Populates an already-created, empty workspace with a realistic Acme Inc.
 * team and realistic product data - projects, tasks, sprints, and
 * comments, spanning a believable range of statuses/priorities/history.
 * `ownerId` must already be a member of `workspaceId` (both callers create
 * the owner's WorkspaceMember row before calling this).
 *
 * Which team-provisioning path runs is decided by the owner's own isDemo
 * flag, not by which caller invoked this function - the same signal the
 * rest of the codebase already treats as canonical for "is this ephemeral"
 * (see invitation.service.ts's own isDemo check). A non-demo owner (the
 * permanent local seed) gets the fixed, real invite/accept team; a demo
 * owner (/try) gets a fresh throwaway team, directly added as members. See
 * ensurePermanentAcmeTeam/ensureEphemeralAcmeTeam for why the mechanism
 * necessarily differs while the resulting team shape does not.
 *
 * Project/task/sprint content below is attributed across the team the
 * block above just resolved, not to `ownerId` alone: `members.*` supplies
 * the actual actor/assignee/project-owner ids for everything except the
 * few project- and sprint-level operations that createProject/createSprint/
 * startSprint/completeSprint/assignTaskToSprint themselves restrict to
 * OWNER/ADMIN (project.service.ts, sprint.service.ts,
 * sprint-task.service.ts) - those still run as `ownerId` or
 * `members.engineeringLead`, the only two roles this workspace has that
 * are ever allowed to perform them. Comments are untouched here
 * deliberately (still `ownerId`, still exactly the two pre-existing
 * comments) - multi-author collaboration is Commit 4's boundary, not this
 * one's.
 */
export async function generateWorkspaceData(workspaceId: string, ownerId: string): Promise<void> {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });

  const members = owner.isDemo
    ? await ensureEphemeralAcmeTeam(workspaceId, owner.demoExpiresAt)
    : await ensurePermanentAcmeTeam(workspaceId, ownerId);

  // ---------------------------------------------------------------------
  // Website Redesign - ACTIVE. Owned by Sofia (the redesign is
  // fundamentally design-led); filed by Alex, the only actor available
  // before Sofia herself is a member with standing to file it. Its sprint
  // is the ACTIVE one: a mix of in-flight statuses, matching the project's
  // own in-flight status.
  // ---------------------------------------------------------------------
  const websiteProject = await ensureProject(workspaceId, ownerId, members.designer, {
    name: "Website Redesign",
    slug: "website-redesign",
    description: "Redesigning the marketing site ahead of the Q1 launch.",
    status: "ACTIVE",
  });

  const websiteTaskSpecs: TaskSeed[] = [
    {
      title: "Finalize responsive navigation states",
      description: "Build the new nav bar to match the approved mockups, mobile included.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: members.frontendEngineer,
      dueDateOffsetDays: 3,
    },
    {
      title: "Design updated homepage hero section",
      description: "High-fidelity mockups for the redesigned homepage hero and nav.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: members.designer,
      dueDateOffsetDays: -10,
    },
    {
      title: "QA cross-browser & device testing",
      description: "Verify the redesigned pages render correctly across major browsers and devices.",
      status: "REVIEW",
      priority: "MEDIUM",
      assigneeId: members.frontendEngineer,
      dueDateOffsetDays: 5,
    },
    {
      // Intentionally overdue (past due, still TODO) - one of Commit 3's
      // ~2 deliberately-overdue tasks.
      title: "Audit accessibility for redesigned pages",
      description:
        "Check color contrast, keyboard navigation, and screen-reader labeling across the new page templates.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: members.designer,
      dueDateOffsetDays: -3,
    },
    {
      title: "Write copy for pricing page",
      description: "Draft final pricing page copy for review.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: ownerId,
      dueDateOffsetDays: 9,
    },
    {
      // Deliberately unassigned - filed by the PM, not yet picked up.
      title: "Set up analytics tracking for marketing pages",
      description: "Wire up event tracking for the new marketing pages.",
      status: "TODO",
      priority: "LOW",
    },
  ];

  const websiteTasks = await Promise.all(
    websiteTaskSpecs.map((spec) =>
      ensureTask(workspaceId, websiteProject.id, taskCreator(spec, members.productManager), spec),
    ),
  );

  const websiteSprint = await ensureSprint(workspaceId, websiteProject.id, ownerId, {
    name: "Sprint 3 — Accessibility & Polish",
    goal: "Ship navigation, hero, and accessibility work for the redesigned marketing site.",
    startDate: offsetDate(-10),
    endDate: offsetDate(4),
  });

  for (const task of websiteTasks.slice(0, 4)) {
    await ensureTaskInSprint(ownerId, websiteSprint.id, task.id);
  }

  await ensureSprintStarted(ownerId, websiteSprint.id);

  await ensureComment(
    ownerId,
    websiteTasks[0]!.id,
    "Nav is functional on desktop - working through mobile breakpoints next.",
  );

  await ensureComment(
    ownerId,
    websiteTasks[2]!.id,
    "Found a layout issue in Safari, filing a follow-up task once triaged.",
  );

  // ---------------------------------------------------------------------
  // Mobile App - ACTIVE. Owned and filed by Maya (the engineering lead
  // driving the initiative). Its sprint is deliberately left PLANNED -
  // upcoming work, not yet started - alongside ad-hoc in-flight tasks
  // that were never in any sprint to begin with.
  // ---------------------------------------------------------------------
  const mobileProject = await ensureProject(workspaceId, members.engineeringLead, members.engineeringLead, {
    name: "Mobile App",
    slug: "mobile-app",
    description: "Native iOS/Android companion app for Acme customers.",
    status: "ACTIVE",
  });

  const mobileTaskSpecs: TaskSeed[] = [
    {
      title: "Implement OAuth login flow",
      description: "Add Google and Apple sign-in to the mobile login screen.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: members.backendEngineer,
      dueDateOffsetDays: -20,
    },
    {
      title: "Build onboarding carousel screens",
      description: "Design and implement the first-run onboarding flow for new mobile users.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: members.frontendEngineer,
      dueDateOffsetDays: 6,
    },
    {
      // Intentionally overdue AND urgent - the second of Commit 3's ~2
      // deliberately-overdue tasks.
      title: "Wire up push notification permissions",
      description: "Prompt for and persist push notification opt-in on first launch.",
      status: "TODO",
      priority: "URGENT",
      assigneeId: members.backendEngineer,
      dueDateOffsetDays: -2,
    },
    {
      title: "Integrate task API pagination for mobile",
      description:
        "Adopt the workspace task API's pagination so the mobile task list doesn't load everything at once.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: members.backendEngineer,
      dueDateOffsetDays: 12,
    },
    {
      title: "Define MVP feature set for v1 release",
      description: "Scope the feature set for the first mobile app release.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: members.engineeringLead,
      dueDateOffsetDays: -25,
    },
    {
      // Deliberately unassigned - filed by the eng lead, not yet claimed.
      title: "Evaluate offline sync strategy",
      description: "Compare local-first sync approaches for spotty-connectivity usage.",
      status: "TODO",
      priority: "LOW",
    },
  ];

  const mobileTasks = await Promise.all(
    mobileTaskSpecs.map((spec) =>
      ensureTask(workspaceId, mobileProject.id, taskCreator(spec, members.engineeringLead), spec),
    ),
  );

  const mobileSprint = await ensureSprint(workspaceId, mobileProject.id, members.engineeringLead, {
    name: "Sprint 1 — Foundation",
    goal: "Land push notifications, pagination, and offline sync groundwork for the mobile beta.",
    startDate: offsetDate(7),
    endDate: offsetDate(21),
  });

  for (const task of [mobileTasks[2]!, mobileTasks[3]!, mobileTasks[5]!]) {
    await ensureTaskInSprint(members.engineeringLead, mobileSprint.id, task.id);
  }

  // ---------------------------------------------------------------------
  // Product Launch - COMPLETED. Owned by Ethan (product manager), filed
  // by Alex. Its sprint runs the full historical lifecycle: created,
  // tasks assigned while still PLANNED, started, then completed - genuine
  // completed-sprint state, not a status inserted directly.
  // ---------------------------------------------------------------------
  const launchProject = await ensureProject(workspaceId, ownerId, members.productManager, {
    name: "Product Launch",
    slug: "product-launch",
    description: "Go-to-market coordination for the v1 release.",
    status: "COMPLETED",
  });

  const launchTaskSpecs: TaskSeed[] = [
    {
      title: "Finalize launch checklist",
      description: "Confirm every launch-day task is complete and owned.",
      status: "DONE",
      priority: "HIGH",
      assigneeId: members.productManager,
      dueDateOffsetDays: -30,
    },
    {
      title: "Send press release",
      description: "Distribute the launch press release to the media list.",
      status: "DONE",
      priority: "MEDIUM",
      assigneeId: members.productManager,
      dueDateOffsetDays: -28,
    },
    {
      title: "Prepare launch-day support runbook",
      description: "Document the on-call plan and known issues for launch-day support.",
      status: "DONE",
      priority: "MEDIUM",
      assigneeId: ownerId,
      dueDateOffsetDays: -29,
    },
    {
      title: "Review post-launch analytics report",
      description: "Summarize the first two weeks of post-launch usage data for the team.",
      status: "DONE",
      priority: "LOW",
      assigneeId: members.productManager,
      dueDateOffsetDays: -18,
    },
  ];

  const launchTasks = await Promise.all(
    launchTaskSpecs.map((spec) =>
      ensureTask(workspaceId, launchProject.id, taskCreator(spec, members.productManager), spec),
    ),
  );

  const launchSprint = await ensureSprint(workspaceId, launchProject.id, ownerId, {
    name: "Sprint 2 — Launch Readiness",
    goal: "Close out every launch-day workstream ahead of the v1 release.",
    startDate: offsetDate(-35),
    endDate: offsetDate(-20),
  });

  for (const task of launchTasks.slice(0, 3)) {
    await ensureTaskInSprint(ownerId, launchSprint.id, task.id);
  }

  await ensureSprintStarted(ownerId, launchSprint.id);
  await ensureSprintCompleted(ownerId, launchSprint.id);

  // ---------------------------------------------------------------------
  // Internal Platform - PLANNED. Owned and filed by Maya. Not started yet,
  // so every task is TODO and every date is in the future (or, for the
  // one urgent item, effectively immediate) - no sprint of its own; the
  // project itself hasn't kicked off.
  // ---------------------------------------------------------------------
  const platformProject = await ensureProject(
    workspaceId,
    members.engineeringLead,
    members.engineeringLead,
    {
      name: "Internal Platform",
      slug: "internal-platform",
      description: "Developer tooling, CI, and observability improvements for Acme's engineering org.",
      status: "PLANNED",
    },
  );

  const platformTaskSpecs: TaskSeed[] = [
    {
      title: "Audit workspace authorization paths",
      description: "Review RBAC checks across workspace, project, and task endpoints for gaps.",
      status: "TODO",
      priority: "HIGH",
      assigneeId: members.backendEngineer,
      dueDateOffsetDays: 15,
    },
    {
      title: "Add API pagination to activity feed",
      description: "Extend the activity feed endpoint to support cursor-based pagination.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: members.backendEngineer,
      dueDateOffsetDays: 20,
    },
    {
      title: "Investigate slow search queries",
      description: "Profile the workspace search endpoint under realistic data volume.",
      status: "TODO",
      priority: "URGENT",
      assigneeId: members.engineeringLead,
      dueDateOffsetDays: 1,
    },
    {
      // Deliberately unassigned - filed by the eng lead, not yet claimed.
      title: "Update production environment documentation",
      description: "Document the current production deployment and environment variables.",
      status: "TODO",
      priority: "LOW",
    },
    {
      title: "Improve CI pipeline caching",
      description: "Cache dependency installs to speed up the CI pipeline.",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: members.backendEngineer,
      dueDateOffsetDays: 25,
    },
  ];

  await Promise.all(
    platformTaskSpecs.map((spec) =>
      ensureTask(workspaceId, platformProject.id, taskCreator(spec, members.engineeringLead), spec),
    ),
  );
}
