import fs from "node:fs/promises";

import request from "supertest";
import type { Express } from "express";

import { prisma } from "../../src/lib/prisma.js";
import {
  ActivityEntityType,
  ActivityType,
  NotificationType,
  WorkspaceRole,
} from "../../src/generated/prisma/enums.js";

export interface AuthenticatedTestUser {
  userId: string;
  email: string;
  password: string;
  cookie: string;
}

/**
 * Signs up through Better Auth's real /api/auth/sign-up/email endpoint (not
 * a mocked session). requireEmailVerification is enabled (see
 * backend/src/lib/auth.ts), so sign-up alone no longer returns a session -
 * this simulates the user clicking their verification email via a direct
 * Prisma write (same "skip the UI, hit the DB directly" shortcut already
 * used by createWorkspaceWithMember/addWorkspaceMember below), then signs
 * in for a real session cookie exactly as a verified user would.
 *
 * The returned cookie authenticates both HTTP (supertest, via
 * `.set("Cookie", cookie)`) and Socket.IO (via `extraHeaders: { Cookie:
 * cookie }`) requests, since both paths ultimately call auth.api.getSession()
 * against the same cookie.
 */
export async function signUpTestUser(app: Express): Promise<AuthenticatedTestUser> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = "password1234";

  const signUpResponse = await request(app)
    .post("/api/auth/sign-up/email")
    .send({
      name: "Test User",
      email,
      password,
    })
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
  // as a real string[] - the type declaration is just incomplete here.
  const setCookie = signInResponse.headers["set-cookie"] as unknown as string[] | undefined;

  if (!setCookie || setCookie.length === 0) {
    throw new Error("Sign-in did not return a session cookie");
  }

  const cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");

  return {
    userId,
    email,
    password,
    cookie,
  };
}

/**
 * Direct Prisma inserts, not the HTTP layer - workspace/membership rows
 * have no security-sensitive internals (unlike auth), so hitting the
 * database directly is simpler and faster for test setup.
 */
export async function createWorkspaceWithMember(
  ownerId: string,
  role: WorkspaceRole = WorkspaceRole.OWNER,
) {
  const workspace = await prisma.workspace.create({
    data: {
      name: "Test Workspace",
      slug: `test-workspace-${crypto.randomUUID()}`,
      ownerId,
    },
  });

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: ownerId,
      role,
    },
  });

  return { workspace, member };
}

/**
 * Adds an additional member to an already-created workspace - direct
 * Prisma insert, same rationale as createWorkspaceWithMember.
 */
export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole = WorkspaceRole.MEMBER,
) {
  return prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId,
      role,
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createWorkspaceWithMember -
 * project rows have no security-sensitive internals worth exercising
 * through the HTTP/service layer just to set up a test fixture.
 */
export async function createProjectDirect(
  workspaceId: string,
  ownerId: string,
  name = "Test Project",
) {
  return prisma.project.create({
    data: {
      workspaceId,
      ownerId,
      name,
      slug: `test-project-${crypto.randomUUID()}`,
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createProjectDirect.
 */
export async function createTaskDirect(
  workspaceId: string,
  projectId: string,
  createdById: string,
  title = "Test Task",
  assigneeId?: string,
) {
  return prisma.task.create({
    data: {
      workspaceId,
      projectId,
      title,
      createdById,
      ...(assigneeId !== undefined && { assigneeId }),
    },
  });
}

/**
 * Composes signUpTestUser + createWorkspaceWithMember + createProjectDirect
 * + createTaskDirect - the common setup shared by every attachment test
 * (tests/attachment/*.test.ts): an authenticated owner, a workspace they
 * belong to, a project, and a task inside it.
 */
export async function setUpTaskWithOwner(app: Express) {
  const owner = await signUpTestUser(app);
  const { workspace } = await createWorkspaceWithMember(owner.userId);
  const project = await createProjectDirect(workspace.id, owner.userId);
  const task = await createTaskDirect(workspace.id, project.id, owner.userId);

  return { owner, workspace, project, task };
}

/**
 * Direct Prisma insert, same rationale as createProjectDirect. Sprint
 * names only need to be unique within a project (see the
 * @@unique([projectId, name]) constraint), so a random suffix avoids
 * collisions across tests without needing a caller-supplied name. `goal`
 * is optional and appended last, same backward-compatible pattern as
 * createCommentDirect/createAttachmentDirect's trailing optional params -
 * every existing caller predates sprint search and has no reason to set
 * it.
 */
export async function createSprintDirect(
  workspaceId: string,
  projectId: string,
  name = `Test Sprint ${crypto.randomUUID().slice(0, 8)}`,
  goal?: string,
) {
  return prisma.sprint.create({
    data: {
      workspaceId,
      projectId,
      name,
      ...(goal !== undefined && { goal }),
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createProjectDirect - scoped
 * narrowly to what pagination-determinism tests need: an explicit
 * `createdAt` (overriding the column's `@default(now())`), since proving
 * `ORDER BY createdAt DESC, id DESC` is deterministic requires rows with
 * identical, caller-controlled timestamps. `type`/`entityType`/`entityId`
 * default to an arbitrary valid combination - their actual values don't
 * matter for pagination-ordering assertions, only that the row is valid.
 */
export async function createActivityDirect(
  workspaceId: string,
  actorId: string,
  createdAt: Date,
  overrides: Partial<{
    type: ActivityType;
    entityType: ActivityEntityType;
    entityId: string;
    taskId: string;
    projectId: string;
  }> = {},
) {
  return prisma.activity.create({
    data: {
      workspaceId,
      actorId,
      createdAt,

      type: overrides.type ?? ActivityType.PROJECT_CREATED,

      entityType: overrides.entityType ?? ActivityEntityType.PROJECT,
      entityId: overrides.entityId ?? crypto.randomUUID(),

      ...(overrides.taskId !== undefined && { taskId: overrides.taskId }),
      ...(overrides.projectId !== undefined && {
        projectId: overrides.projectId,
      }),
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createProjectDirect. `status`
 * defaults to PENDING via the schema, but `token` and `expiresAt` have no
 * schema default, so they're generated here the same way createInvitation
 * does (invitation.service.ts).
 */
export async function createInvitationDirect(
  workspaceId: string,
  invitedById: string,
  role: WorkspaceRole = WorkspaceRole.MEMBER,
  email = `invitee-${crypto.randomUUID()}@example.com`,
) {
  return prisma.workspaceInvitation.create({
    data: {
      workspaceId,
      invitedById,
      email,
      role,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createProjectDirect. `createdAt`
 * is optional and appended last (unlike createActivityDirect's required,
 * positional equivalent) since every existing caller of this fixture
 * predates comment pagination and has no reason to control it - only
 * omitted entirely (letting the column's own @default(now()) apply) unless
 * a caller explicitly needs a deterministic timestamp, e.g. to prove
 * pagination ordering under tied createdAt values.
 */
export async function createCommentDirect(
  workspaceId: string,
  taskId: string,
  authorId: string,
  content = "Test comment",
  createdAt?: Date,
) {
  return prisma.comment.create({
    data: {
      workspaceId,
      taskId,
      authorId,
      content,
      ...(createdAt !== undefined && { createdAt }),
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createProjectDirect - with one
 * caveat the others don't have: `storageKey` here does not point to a real
 * file on disk. downloadAttachment and deleteAttachment both call
 * requireWorkspaceMembership() before ever touching storage
 * (attachment.service.ts), so this fixture is valid for proving the
 * authorization boundary rejects a non-member, but it is NOT valid for a
 * positive control asserting a successful download streams real file
 * content - that would need a file actually written through the local
 * storage provider.
 *
 * `createdAt` is optional and appended last, same backward-compatible
 * pattern as createCommentDirect - every existing caller predates
 * attachment pagination and has no reason to control it, so it's only
 * included in `data` (overriding the column's own @default(now())) when a
 * caller explicitly needs a deterministic timestamp, e.g. to prove
 * pagination ordering under tied createdAt values.
 */
export async function createAttachmentDirect(
  workspaceId: string,
  taskId: string,
  uploadedById: string,
  originalName = "test-file.txt",
  createdAt?: Date,
) {
  return prisma.attachment.create({
    data: {
      workspaceId,
      taskId,
      uploadedById,
      originalName,
      storageKey: `test/${crypto.randomUUID()}`,
      storageFileName: crypto.randomUUID(),
      mimeType: "text/plain",
      size: 128,
      ...(createdAt !== undefined && { createdAt }),
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createActivityDirect - `createdAt`
 * is required and positional (not optional/trailing like
 * createCommentDirect/createAttachmentDirect) since every caller of this
 * fixture is a notification-pagination or read-state test that needs to
 * control ordering deterministically, unlike those two fixtures' callers.
 * `overrides` covers the handful of fields notification-service tests need
 * to set directly rather than through the real markRead/markAllRead flow
 * (e.g. seeding an already-deleted or already-read row to prove it's
 * excluded/unaffected) - `workspaceId` only satisfies the schema's required
 * FK and is never filtered on by notification.service.ts itself.
 */
export async function createNotificationDirect(
  workspaceId: string,
  recipientId: string,
  createdAt: Date,
  overrides: Partial<{
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    readAt: Date | null;
    deletedAt: Date | null;
  }> = {},
) {
  return prisma.notification.create({
    data: {
      workspaceId,
      recipientId,
      createdAt,

      type: overrides.type ?? NotificationType.TASK_ASSIGNED,

      title: overrides.title ?? "Test Notification",
      message: overrides.message ?? "Test notification message",

      ...(overrides.isRead !== undefined && { isRead: overrides.isRead }),
      ...(overrides.readAt !== undefined && { readAt: overrides.readAt }),
      ...(overrides.deletedAt !== undefined && { deletedAt: overrides.deletedAt }),
    },
  });
}

/**
 * Generic filesystem existence check - shared by any test asserting on the
 * local storage provider's physical files (see tests/attachment/*.test.ts),
 * not tied to any single Prisma model the way the fixtures above are.
 */
export async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}
