import crypto from "node:crypto";

import { Prisma } from "../../generated/prisma/client.js";

import {
  ActivityEntityType,
  ActivityType,
  InvitationStatus,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import { prisma } from "../../lib/prisma.js";

import { createActivity } from "../activity/activity.service.js";

import { enqueueWorkspaceInvitationEmail } from "../../queues/email/index.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

import type {
  CreateInvitationData,
  InvitationResponse,
} from "./invitation.types.js";

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

async function findInvitationById(invitationId: string) {
  return prisma.workspaceInvitation.findUnique({
    where: {
      id: invitationId,
    },
  });
}

async function findPendingInvitation(workspaceId: string, email: string) {
  return prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email,
      status: InvitationStatus.PENDING,
    },
  });
}

async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
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

function isInvitationExpired(invitation: { expiresAt: Date }) {
  return invitation.expiresAt < new Date();
}

type InvitationEntity = {
  id: string;

  workspaceId: string;

  email: string;

  role: InvitationResponse["role"];

  invitedById: string;

  status: InvitationResponse["status"];

  expiresAt: Date;

  createdAt: Date;
};

function toInvitationResponse(
  invitation: InvitationEntity,
): InvitationResponse {
  return {
    id: invitation.id,

    workspaceId: invitation.workspaceId,

    email: invitation.email,

    role: invitation.role,

    invitedById: invitation.invitedById,

    status: invitation.status,

    expiresAt: invitation.expiresAt,

    createdAt: invitation.createdAt,
  };
}

function toInvitationRealtimeResponse(invitation: InvitationEntity) {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

export async function createInvitation(
  data: CreateInvitationData,
): Promise<InvitationResponse> {
  const workspace = await getWorkspaceById(data.workspaceId);

  const actorMembership = await getWorkspaceMembership(
    data.workspaceId,
    data.invitedById,
  );

  const actor = await prisma.user.findUnique({
    where: {
      id: data.invitedById,
    },
    select: {
      name: true,
    },
  });

  if (!actor) {
    throw new NotFoundError("User not found");
  }

  if (!canAssignRole(actorMembership.role, data.role)) {
    throw new ForbiddenError("You do not have permission to assign this role");
  }

  const email = data.email.toLowerCase();
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: data.workspaceId,
          userId: existingUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new ValidationError("User is already a member of this workspace");
    }
  }

  const existingInvitation = await findPendingInvitation(
    data.workspaceId,
    email,
  );

  if (existingInvitation) {
    throw new ValidationError("Pending invitation already exists");
  }

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: data.workspaceId,

      email: email,

      role: data.role,

      invitedById: data.invitedById,

      token: crypto.randomUUID(),

      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await createActivity({
    workspaceId: invitation.workspaceId,

    actorId: data.invitedById,

    type: ActivityType.USER_INVITED,

    entityType: ActivityEntityType.INVITATION,
    entityId: invitation.id,

    metadata: {
      invitedEmail: invitation.email,
      role: invitation.role,
    },
  });

  await enqueueWorkspaceInvitationEmail({
    invitationId: invitation.id,
    email: invitation.email,
    workspaceName: workspace.name,
    role: invitation.role,
    invitedByName: actor.name,
    token: invitation.token,
    expiresAt: invitation.expiresAt.toISOString(),
  });

  const response = toInvitationResponse(invitation);

  emitToWorkspace(invitation.workspaceId, REALTIME_EVENTS.INVITATION_CREATED, {
    workspaceId: invitation.workspaceId,
    invitation: toInvitationRealtimeResponse(invitation),
  });

  return response;
}

export async function listWorkspaceInvitations(
  workspaceId: string,
  actorId: string,
): Promise<InvitationResponse[]> {
  const membership = await getWorkspaceMembership(workspaceId, actorId);

  if (
    membership.role !== WorkspaceRole.OWNER &&
    membership.role !== WorkspaceRole.ADMIN
  ) {
    throw new ForbiddenError("You do not have permission to view invitations");
  }

  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      workspaceId,
      status: InvitationStatus.PENDING,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return invitations.map(toInvitationResponse);
}

export async function listUserInvitations(
  email: string,
): Promise<InvitationResponse[]> {
  const normalizedEmail = email.toLowerCase();
  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      email: normalizedEmail,

      status: InvitationStatus.PENDING,

      expiresAt: {
        gt: new Date(),
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return invitations.map(toInvitationResponse);
}

export async function acceptInvitation(
  invitationId: string,
  userId: string,
  email: string,
): Promise<InvitationResponse> {
  const invitation = await findInvitationById(invitationId);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ValidationError("Invitation is no longer pending");
  }

  if (isInvitationExpired(invitation)) {
    throw new ValidationError("Invitation has expired");
  }

  const normalizedEmail = email.toLowerCase();

  if (invitation.email !== normalizedEmail) {
    throw new ForbiddenError("You do not have access to this invitation");
  }

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    },
  });

  if (existingMembership) {
    throw new ValidationError("You are already a member of this workspace");
  }

  const updatedInvitation = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      });

      return tx.workspaceInvitation.update({
        where: {
          id: invitation.id,
        },

        data: {
          status: InvitationStatus.ACCEPTED,
        },
      });
    },
  );

  await createActivity({
    workspaceId: invitation.workspaceId,

    actorId: userId,

    type: ActivityType.INVITATION_ACCEPTED,

    entityType: ActivityEntityType.INVITATION,
    entityId: invitation.id,

    metadata: {
      invitedEmail: invitation.email,
      role: invitation.role,
    },
  });

  const response = toInvitationResponse(updatedInvitation);

  emitToWorkspace(
    updatedInvitation.workspaceId,
    REALTIME_EVENTS.INVITATION_ACCEPTED,
    {
      workspaceId: updatedInvitation.workspaceId,
      invitation: toInvitationRealtimeResponse(updatedInvitation),
    },
  );

  return response;
}

export async function declineInvitation(
  invitationId: string,
  email: string,
): Promise<InvitationResponse> {
  const invitation = await findInvitationById(invitationId);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ValidationError("Invitation is no longer pending");
  }

  if (isInvitationExpired(invitation)) {
    throw new ValidationError("Invitation has expired");
  }

  const normalizedEmail = email.toLowerCase();

  if (invitation.email !== normalizedEmail) {
    throw new ForbiddenError("You do not have access to this invitation");
  }

  const updatedInvitation = await prisma.workspaceInvitation.update({
    where: {
      id: invitation.id,
    },

    data: {
      status: InvitationStatus.DECLINED,
    },
  });

  const user = await findUserByEmail(normalizedEmail);

  if (user) {
    await createActivity({
      workspaceId: invitation.workspaceId,

      actorId: user.id,

      type: ActivityType.INVITATION_DECLINED,

      entityType: ActivityEntityType.INVITATION,
      entityId: invitation.id,

      metadata: {
        invitedEmail: invitation.email,
        role: invitation.role,
      },
    });
  }

  const response = toInvitationResponse(updatedInvitation);

  emitToWorkspace(
    updatedInvitation.workspaceId,
    REALTIME_EVENTS.INVITATION_DECLINED,
    {
      workspaceId: updatedInvitation.workspaceId,
      invitation: toInvitationRealtimeResponse(updatedInvitation),
    },
  );

  return response;
}

export { findInvitationById };
