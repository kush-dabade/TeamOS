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
