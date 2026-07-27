import { prisma } from "../../lib/prisma.js";
import { generateSlug } from "../../lib/slug.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { WorkspaceRole } from "../../generated/prisma/enums.js";
import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import type { CreateWorkspaceData } from "./workspace.types.js";
import type { UpdateWorkspaceInput } from "./workspace.schema.js";

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = generateSlug(name);

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existingWorkspace = await prisma.workspace.findUnique({
      where: {
        slug,
      },
    });

    if (!existingWorkspace) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  return membership;
}

async function getWorkspaceById(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
  });

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  return workspace;
}

async function getWorkspaceMemberById(workspaceId: string, memberId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      id: memberId,
      workspaceId,
    },

    include: {
      user: true,
    },
  });

  if (!member) {
    throw new NotFoundError("Workspace member not found");
  }

  return member;
}

function canManageMember(actorRole: WorkspaceRole, targetRole: WorkspaceRole) {
  if (actorRole === WorkspaceRole.OWNER) {
    return (
      targetRole === WorkspaceRole.ADMIN ||
      targetRole === WorkspaceRole.MEMBER ||
      targetRole === WorkspaceRole.GUEST
    );
  }

  if (actorRole === WorkspaceRole.ADMIN) {
    return (
      targetRole === WorkspaceRole.MEMBER || targetRole === WorkspaceRole.GUEST
    );
  }

  return false;
}

function canAssignRole(actorRole: WorkspaceRole, role: WorkspaceRole) {
  if (actorRole === WorkspaceRole.OWNER) {
    return (
      role === WorkspaceRole.ADMIN ||
      role === WorkspaceRole.MEMBER ||
      role === WorkspaceRole.GUEST
    );
  }

  if (actorRole === WorkspaceRole.ADMIN) {
    return role === WorkspaceRole.MEMBER || role === WorkspaceRole.GUEST;
  }

  return false;
}

export async function createWorkspace(data: CreateWorkspaceData) {
  const slug = await generateUniqueSlug(data.name);

  const workspace = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug,
          ownerId: data.ownerId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: data.ownerId,
          role: WorkspaceRole.OWNER,
        },
      });

      return workspace;
    },
  );

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
  };
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
    },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return memberships.map(
    (
      membership: Prisma.WorkspaceMemberGetPayload<{
        include: { workspace: true };
      }>,
    ) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
      createdAt: membership.workspace.createdAt,
    }),
  );
}

export async function getWorkspace(workspaceId: string, actorId: string) {
  const membership = await getWorkspaceMembership(workspaceId, actorId);
  const workspace = await getWorkspaceById(workspaceId);

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: membership.role,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export async function updateWorkspace(
  actorId: string,
  workspaceId: string,
  data: UpdateWorkspaceInput,
) {
  const membership = await getWorkspaceMembership(workspaceId, actorId);

  if (membership.role !== WorkspaceRole.OWNER) {
    throw new ForbiddenError(
      "Only the workspace owner can update this workspace",
    );
  }

  const workspace = await prisma.workspace.update({
    where: {
      id: workspaceId,
    },

    data: {
      name: data.name,
    },
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: membership.role,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export async function listWorkspaceMembers(
  workspaceId: string,
  actorId: string,
) {
  await getWorkspaceMembership(workspaceId, actorId);

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
    },

    include: {
      user: true,
    },

    orderBy: {
      joinedAt: "asc",
    },
  });

  return members.map((member) => ({
    id: member.id,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    joinedAt: member.joinedAt,
  }));
}

export async function updateWorkspaceMemberRole(
  actorId: string,
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
) {
  const actorMembership = await getWorkspaceMembership(workspaceId, actorId);

  const targetMember = await getWorkspaceMemberById(workspaceId, memberId);

  const workspace = await getWorkspaceById(workspaceId);

  if (targetMember.userId === workspace.ownerId) {
    throw new ValidationError("Workspace owner role cannot be changed");
  }

  if (!canManageMember(actorMembership.role, targetMember.role)) {
    throw new ForbiddenError(
      "You do not have permission to manage this member",
    );
  }

  if (!canAssignRole(actorMembership.role, role)) {
    throw new ForbiddenError("You do not have permission to assign this role");
  }

  if (targetMember.role === role) {
    throw new ValidationError("Member already has this role");
  }

  const updatedMember = await prisma.workspaceMember.update({
    where: {
      id: memberId,
    },

    data: {
      role,
    },

    include: {
      user: true,
    },
  });

  return {
    id: updatedMember.id,
    userId: updatedMember.userId,
    name: updatedMember.user.name,
    email: updatedMember.user.email,
    role: updatedMember.role,
    joinedAt: updatedMember.joinedAt,
  };
}

export async function removeWorkspaceMember(
  actorId: string,
  workspaceId: string,
  memberId: string,
) {
  const actorMembership = await getWorkspaceMembership(workspaceId, actorId);

  const targetMember = await getWorkspaceMemberById(workspaceId, memberId);

  const workspace = await getWorkspaceById(workspaceId);

  if (targetMember.userId === workspace.ownerId) {
    throw new ValidationError("Workspace owner cannot be removed");
  }

  if (!canManageMember(actorMembership.role, targetMember.role)) {
    throw new ForbiddenError(
      "You do not have permission to manage this member",
    );
  }

  await prisma.workspaceMember.delete({
    where: {
      id: memberId,
    },
  });

  return {
    success: true,
  };
}
