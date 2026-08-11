import request from "supertest";
import type { Express } from "express";

import { prisma } from "../../src/lib/prisma.js";
import { WorkspaceRole } from "../../src/generated/prisma/enums.js";

export interface AuthenticatedTestUser {
  userId: string;
  cookie: string;
}

/**
 * Signs up through Better Auth's real /api/auth/sign-up/email endpoint (not
 * a mocked session) and returns the resulting session cookie. emailAndPassword
 * is configured with no requireEmailVerification and Better Auth's default
 * autoSignIn: true (see backend/src/lib/auth.ts), so sign-up alone already
 * returns an active session - no separate sign-in call is needed.
 *
 * The returned cookie authenticates both HTTP (supertest, via
 * `.set("Cookie", cookie)`) and Socket.IO (via `extraHeaders: { Cookie:
 * cookie }`) requests, since both paths ultimately call auth.api.getSession()
 * against the same cookie.
 */
export async function signUpTestUser(app: Express): Promise<AuthenticatedTestUser> {
  const email = `test-${crypto.randomUUID()}@example.com`;

  const response = await request(app)
    .post("/api/auth/sign-up/email")
    .send({
      name: "Test User",
      email,
      password: "password1234",
    })
    .expect(200);

  // @types/superagent types Response.headers as { [k: string]: string },
  // but Node's http layer always exposes repeated headers like set-cookie
  // as a real string[] - the type declaration is just incomplete here.
  const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;

  if (!setCookie || setCookie.length === 0) {
    throw new Error("Sign-up did not return a session cookie");
  }

  const cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");

  return {
    userId: response.body.user.id,
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
