import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import type { WorkspaceMember } from "../../generated/prisma/client.js";
import type { WorkspaceRole } from "../../generated/prisma/enums.js";

import { ForbiddenError } from "../errors/forbidden-error.js";

export async function findWorkspaceMembership(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember | null> {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

export async function requireWorkspaceMembership(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember> {
  const membership = await findWorkspaceMembership(workspaceId, userId);

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  return membership;
}

export function requireRole(
  membership: WorkspaceMember,
  roles: WorkspaceRole[],
): void {
  if (!roles.includes(membership.role)) {
    throw new ForbiddenError(
      "You do not have permission to perform this action",
    );
  }
}

export interface LockedWorkspaceMembership {
  id: string;
  role: WorkspaceRole;
}

/**
 * Locks the target's WorkspaceMember row (SELECT ... FOR UPDATE) for the
 * remainder of the caller's transaction. This is the shared serialization
 * point between transferProjectOwnership and removeWorkspaceMember: both
 * must acquire this lock as the FIRST statement in their transaction so
 * that whichever commits first is the one the other observes. Returns null
 * if no matching row exists (nothing to lock - the user is not, or is no
 * longer, a member of this workspace).
 */
export async function lockWorkspaceMembership(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  userId: string,
): Promise<LockedWorkspaceMembership | null> {
  const rows = await tx.$queryRaw<LockedWorkspaceMembership[]>(Prisma.sql`
    SELECT "id", "role"
    FROM "WorkspaceMember"
    WHERE "workspaceId" = ${workspaceId} AND "userId" = ${userId}
    FOR UPDATE
  `);

  return rows[0] ?? null;
}
