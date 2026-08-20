import crypto from "node:crypto";

import { Prisma } from "../../generated/prisma/client.js";

import {
  ActivityEntityType,
  ActivityType,
  InvitationStatus,
  NotificationType,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

import { prisma } from "../../lib/prisma.js";

import { createActivity } from "../activity/activity.service.js";

import { enqueueNotification } from "../../queues/notification/index.js";
import { enqueueWorkspaceInvitationEmail } from "../../queues/email/index.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import {
  findWorkspaceMembership,
  requireWorkspaceMembership,
  requireRole,
} from "../../shared/authorization/workspace-access.js";

import type {
  CreateInvitationData,
  InvitationPreviewResponse,
  InvitationResponse,
} from "./invitation.types.js";

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

async function findInvitationByToken(token: string) {
  return prisma.workspaceInvitation.findUnique({
    where: {
      token,
    },
  });
}

async function findInvitationPreviewByToken(token: string) {
  return prisma.workspaceInvitation.findUnique({
    where: {
      token,
    },
    include: {
      workspace: {
        select: {
          name: true,
        },
      },
      invitedBy: {
        select: {
          name: true,
        },
      },
    },
  });
}

async function getWorkspaceInvitationById(
  workspaceId: string,
  invitationId: string,
) {
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      id: invitationId,
      workspaceId,
    },
  });

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  return invitation;
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

function assertInvitationEligible(
  invitation: InvitationEntity,
  email: string,
): void {
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ValidationError("Invitation is no longer pending");
  }

  if (isInvitationExpired(invitation)) {
    throw new ValidationError("Invitation has expired");
  }

  if (invitation.email !== email.toLowerCase()) {
    throw new ForbiddenError("You do not have access to this invitation");
  }
}

function isRecordNotFoundError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
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
  const actorMembership = await requireWorkspaceMembership(
    data.workspaceId,
    data.invitedById,
  );

  const workspace = await getWorkspaceById(data.workspaceId);

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
    const existingMembership = await findWorkspaceMembership(
      data.workspaceId,
      existingUser.id,
    );

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

  if (existingUser) {
    try {
      await enqueueNotification({
        workspaceId: invitation.workspaceId,
        recipientId: existingUser.id,
        type: NotificationType.INVITATION_RECEIVED,
        title: "Workspace Invitation",
        message: `${actor.name} invited you to join "${workspace.name}".`,
        // Only ever enqueued from createInvitation() - resendInvitation()
        // does not call enqueueNotification, only enqueueWorkspaceInvitationEmail
        // - so this notification is a genuine one-time event per invitation;
        // its own id already uniquely identifies it.
        eventId: invitation.id,
        metadata: {
          invitationId: invitation.id,
          workspaceName: workspace.name,
          role: invitation.role,
        },
      });
    } catch (error) {
      console.error("Failed to create invitation notification:", error);
    }
  }

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
  const membership = await requireWorkspaceMembership(workspaceId, actorId);

  requireRole(membership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

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

export async function cancelInvitation(
  actorId: string,
  workspaceId: string,
  invitationId: string,
): Promise<{ success: true }> {
  const actorMembership = await requireWorkspaceMembership(workspaceId, actorId);

  requireRole(actorMembership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

  const invitation = await getWorkspaceInvitationById(workspaceId, invitationId);

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ValidationError("Invitation is no longer pending");
  }

  try {
    await prisma.workspaceInvitation.delete({
      where: {
        id: invitation.id,
      },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new NotFoundError("Invitation not found");
    }

    throw error;
  }

  return { success: true };
}

export async function resendInvitation(
  actorId: string,
  workspaceId: string,
  invitationId: string,
): Promise<InvitationResponse> {
  const actorMembership = await requireWorkspaceMembership(workspaceId, actorId);

  requireRole(actorMembership, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

  const invitation = await getWorkspaceInvitationById(workspaceId, invitationId);

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ValidationError("Invitation is no longer pending");
  }

  const workspace = await getWorkspaceById(workspaceId);

  const inviter = await prisma.user.findUnique({
    where: {
      id: invitation.invitedById,
    },
    select: {
      name: true,
    },
  });

  if (!inviter) {
    throw new NotFoundError("User not found");
  }

  let updatedInvitation;

  try {
    updatedInvitation = await prisma.workspaceInvitation.update({
      where: {
        id: invitation.id,
      },

      data: {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new NotFoundError("Invitation not found");
    }

    throw error;
  }

  await enqueueWorkspaceInvitationEmail({
    invitationId: updatedInvitation.id,
    email: updatedInvitation.email,
    workspaceName: workspace.name,
    role: updatedInvitation.role,
    invitedByName: inviter.name,
    token: updatedInvitation.token,
    expiresAt: updatedInvitation.expiresAt.toISOString(),
  });

  return toInvitationResponse(updatedInvitation);
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

export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreviewResponse> {
  const invitation = await findInvitationPreviewByToken(token);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  return {
    workspaceName: invitation.workspace.name,
    invitedByName: invitation.invitedBy.name,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  };
}

async function acceptResolvedInvitation(
  invitation: InvitationEntity,
  userId: string,
  email: string,
): Promise<InvitationResponse> {
  assertInvitationEligible(invitation, email);

  const existingMembership = await findWorkspaceMembership(
    invitation.workspaceId,
    userId,
  );

  if (existingMembership) {
    throw new ValidationError("You are already a member of this workspace");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const { count } = await tx.workspaceInvitation.updateMany({
      where: {
        id: invitation.id,
        status: InvitationStatus.PENDING,
      },

      data: {
        status: InvitationStatus.ACCEPTED,
      },
    });

    if (count === 0) {
      throw new ValidationError("Invitation is no longer pending");
    }

    await tx.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
      },
    });
  });

  const updatedInvitation: InvitationEntity = {
    ...invitation,
    status: InvitationStatus.ACCEPTED,
  };

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

export async function acceptInvitation(
  invitationId: string,
  userId: string,
  email: string,
): Promise<InvitationResponse> {
  const invitation = await findInvitationById(invitationId);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  return acceptResolvedInvitation(invitation, userId, email);
}

export async function acceptInvitationByToken(
  token: string,
  userId: string,
  email: string,
): Promise<InvitationResponse> {
  const invitation = await findInvitationByToken(token);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  return acceptResolvedInvitation(invitation, userId, email);
}

async function declineResolvedInvitation(
  invitation: InvitationEntity,
  userId: string,
  email: string,
): Promise<InvitationResponse> {
  assertInvitationEligible(invitation, email);

  const { count } = await prisma.workspaceInvitation.updateMany({
    where: {
      id: invitation.id,
      status: InvitationStatus.PENDING,
    },

    data: {
      status: InvitationStatus.DECLINED,
    },
  });

  if (count === 0) {
    throw new ValidationError("Invitation is no longer pending");
  }

  const updatedInvitation: InvitationEntity = {
    ...invitation,
    status: InvitationStatus.DECLINED,
  };

  await createActivity({
    workspaceId: invitation.workspaceId,

    actorId: userId,

    type: ActivityType.INVITATION_DECLINED,

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
    REALTIME_EVENTS.INVITATION_DECLINED,
    {
      workspaceId: updatedInvitation.workspaceId,
      invitation: toInvitationRealtimeResponse(updatedInvitation),
    },
  );

  return response;
}

export async function declineInvitation(
  invitationId: string,
  userId: string,
  email: string,
): Promise<InvitationResponse> {
  const invitation = await findInvitationById(invitationId);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  return declineResolvedInvitation(invitation, userId, email);
}

export async function declineInvitationByToken(
  token: string,
  userId: string,
  email: string,
): Promise<InvitationResponse> {
  const invitation = await findInvitationByToken(token);

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  return declineResolvedInvitation(invitation, userId, email);
}
