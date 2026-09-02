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
import { createSprint, startSprint } from "../sprint/sprint.service.js";
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
 * Project/task/sprint/comment content below still runs entirely as
 * `ownerId`, unchanged from before this function grew a team - attributing
 * that content to the new team members is deliberately left to a later
 * commit, not folded in here.
 */
export async function generateWorkspaceData(workspaceId: string, ownerId: string): Promise<void> {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });

  if (owner.isDemo) {
    await ensureEphemeralAcmeTeam(workspaceId, owner.demoExpiresAt);
  } else {
    await ensurePermanentAcmeTeam(workspaceId, ownerId);
  }

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
