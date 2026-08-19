import request from "supertest";
import type { Express } from "express";

import { prisma } from "../../src/lib/prisma.js";
import {
  ActivityEntityType,
  ActivityType,
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
) {
  return prisma.task.create({
    data: {
      workspaceId,
      projectId,
      title,
      createdById,
    },
  });
}

/**
 * Direct Prisma insert, same rationale as createProjectDirect. Sprint
 * names only need to be unique within a project (see the
 * @@unique([projectId, name]) constraint), so a random suffix avoids
 * collisions across tests without needing a caller-supplied name.
 */
export async function createSprintDirect(
  workspaceId: string,
  projectId: string,
  name = `Test Sprint ${crypto.randomUUID().slice(0, 8)}`,
) {
  return prisma.sprint.create({
    data: {
      workspaceId,
      projectId,
      name,
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
