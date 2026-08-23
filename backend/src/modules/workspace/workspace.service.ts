import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { generateSlug } from "../../lib/slug.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  ActivityEntityType,
  ActivityType,
  NotificationType,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";
import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import { isRecordNotFoundError } from "../../shared/errors/prisma-errors.js";
import {
  lockWorkspaceMembership,
  requireWorkspaceMembership,
  requireRole,
} from "../../shared/authorization/workspace-access.js";
import type { CreateWorkspaceData } from "./workspace.types.js";
import type { UpdateWorkspaceInput } from "./workspace.schema.js";
import { createActivity } from "../activity/activity.service.js";
import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { evictFromWorkspace } from "../../realtime/realtime.eviction.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";
import { enqueueNotification } from "../../queues/notification/index.js";

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
  const membership = await requireWorkspaceMembership(workspaceId, actorId);
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
  const membership = await requireWorkspaceMembership(workspaceId, actorId);

  requireRole(membership, [WorkspaceRole.OWNER]);

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
  await requireWorkspaceMembership(workspaceId, actorId);

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
    image: member.user.image,
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
  const actorMembership = await requireWorkspaceMembership(workspaceId, actorId);

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

  const oldRole = targetMember.role;

  let emitActivityCreated: () => void = () => {};

  const updatedMember = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Translates a concurrent removeWorkspaceMember that deletes this
      // membership between the reads above and this update into the same
      // typed NotFoundError getWorkspaceMemberById would have thrown had it
      // read after that removal committed, rather than a raw unhandled
      // Prisma P2025. No cross-table invariant is at risk here (unlike
      // transferProjectOwnership/removeWorkspaceMember), so a plain catch is
      // sufficient - no row lock needed.
      let updated;

      try {
        updated = await tx.workspaceMember.update({
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
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          throw new NotFoundError("Workspace member not found");
        }

        throw error;
      }

      emitActivityCreated = await createActivity(
        {
          workspaceId,
          actorId,

          type: ActivityType.MEMBER_ROLE_CHANGED,

          entityType: ActivityEntityType.MEMBER,
          entityId: updated.id,

          metadata: {
            oldRole,
            newRole: role,
          },
        },
        tx,
      );

      return updated;
    },
  );

  emitActivityCreated();

  emitToWorkspace(workspaceId, REALTIME_EVENTS.MEMBER_ROLE_CHANGED, {
    workspaceId,
    memberId: updatedMember.id,
    userId: updatedMember.userId,
    oldRole,
    newRole: updatedMember.role,
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

async function countOwnedProjects(
  workspaceId: string,
  ownerId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<number> {
  return client.project.count({
    where: {
      workspaceId,
      ownerId,
    },
  });
}

export async function removeWorkspaceMember(
  actorId: string,
  workspaceId: string,
  memberId: string,
) {
  const actorMembership = await requireWorkspaceMembership(workspaceId, actorId);

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

  // Fail fast, before opening a transaction, for the common case - this
  // precondition has no side effects of its own. Not authoritative: the
  // locked re-check inside the transaction below is what actually guards
  // against ownership being transferred to this member in the gap between
  // this read and that one.
  const ownedProjectCount = await countOwnedProjects(workspaceId, targetMember.userId);

  if (ownedProjectCount > 0) {
    throw new ValidationError(
      `Cannot remove member: they own ${ownedProjectCount} project(s). Transfer ownership before removal.`,
    );
  }

  let emitActivityCreated: () => void = () => {};

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // First statement in the transaction: locks this member's
    // WorkspaceMember row, the shared serialization point with
    // transferProjectOwnership. A concurrent second removal of this same
    // member (its membership row already gone by the time this transaction
    // reaches the lock) surfaces here as a typed NotFoundError, the same
    // one getWorkspaceMemberById would have thrown had it read after that
    // removal committed.
    const lockedMembership = await lockWorkspaceMembership(
      tx,
      workspaceId,
      targetMember.userId,
    );

    if (!lockedMembership) {
      throw new NotFoundError("Workspace member not found");
    }

    // Re-checked after acquiring the lock above, not before - this is what
    // makes it authoritative against a concurrent transferProjectOwnership,
    // which acquires the same lock before writing Project.ownerId. If a
    // transfer lands ownership on this member and commits before this
    // point, this re-check is guaranteed to observe it.
    const recheckedOwnedCount = await countOwnedProjects(
      workspaceId,
      targetMember.userId,
      tx,
    );

    if (recheckedOwnedCount > 0) {
      throw new ValidationError(
        `Cannot remove member: they own ${recheckedOwnedCount} project(s). Transfer ownership before removal.`,
      );
    }

    await tx.task.updateMany({
      where: {
        workspaceId,
        assigneeId: targetMember.userId,
        deletedAt: null,
      },
      data: {
        assigneeId: null,
      },
    });

    // No not-found handling needed here: the lock above already holds this
    // exact row for the rest of the transaction, so no concurrent
    // delete/update can reach it first.
    await tx.workspaceMember.delete({
      where: {
        id: memberId,
      },
    });

    emitActivityCreated = await createActivity(
      {
        workspaceId,
        actorId,

        type: ActivityType.MEMBER_REMOVED,

        entityType: ActivityEntityType.MEMBER,
        entityId: memberId,

        metadata: {
          removedUserName: targetMember.user.name,
          removedUserEmail: targetMember.user.email,
        },
      },
      tx,
    );
  });

  emitActivityCreated();

  emitToWorkspace(workspaceId, REALTIME_EVENTS.MEMBER_REMOVED, {
    workspaceId,
    memberId,
    userId: targetMember.userId,
  });

  // Best-effort: the membership is already gone at this point, so a failure
  // here must not fail the request. This is not reachable in practice today
  // (see realtime.eviction.ts's own comment on why), so this branch exists
  // as a guard for once a network-backed Socket.IO adapter is introduced -
  // if it ever does fire, the residual risk is bounded, not open-ended: the
  // removed member's already-open socket(s) would keep receiving this
  // workspace's events until they next disconnect/reconnect
  // (joinWorkspaceRooms re-checks membership fresh from the database every
  // time), not indefinitely.
  try {
    await evictFromWorkspace(workspaceId, targetMember.userId);
  } catch (error) {
    logger.error(
      { err: error, workspaceId, userId: targetMember.userId },
      "SECURITY: failed to evict removed member's sockets after retries - they may " +
        "continue receiving this workspace's realtime events until their socket " +
        "next disconnects/reconnects",
    );
  }
}

export async function transferWorkspaceOwnership(
  actorId: string,
  workspaceId: string,
  memberId: string,
) {
  const actorMembership = await requireWorkspaceMembership(workspaceId, actorId);

  const workspace = await getWorkspaceById(workspaceId);

  if (workspace.ownerId !== actorId) {
    throw new ForbiddenError("Only the workspace owner can transfer ownership");
  }

  if (actorMembership.role !== WorkspaceRole.OWNER) {
    // Workspace.ownerId and WorkspaceMember.role are two sources of truth for
    // ownership that are kept in sync manually. They should never drift, but
    // if they do, fail closed instead of transferring ownership from a
    // membership that doesn't actually hold the OWNER role.
    throw new ValidationError(
      "Workspace ownership data is inconsistent and ownership cannot be transferred",
    );
  }

  const targetMember = await getWorkspaceMemberById(workspaceId, memberId);

  if (targetMember.userId === workspace.ownerId) {
    throw new ValidationError("Cannot transfer ownership to the current owner");
  }

  if (targetMember.role === WorkspaceRole.GUEST) {
    // Guests have read-only access (docs/architecture/api-specification.md,
    // RBAC Rules) - ownership grants full access, so a guest is never an
    // eligible transfer target.
    throw new ValidationError("Ownership cannot be transferred to a guest");
  }

  const { transferredWorkspace, newOwnerMembership } =
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Compare-and-set: only proceed if `actorId` is still the owner of
      // record at the moment this transaction runs. Every check above was
      // read outside the transaction, so a second concurrent transfer for
      // this workspace could otherwise have already committed by the time
      // this one reaches the transaction - blindly updating here would let
      // both "succeed" and leave two WorkspaceMember rows marked OWNER while
      // Workspace.ownerId reflects only whichever transaction ran last.
      const ownershipUpdate = await tx.workspace.updateMany({
        where: {
          id: workspaceId,
          ownerId: actorId,
        },
        data: {
          ownerId: targetMember.userId,
        },
      });

      if (ownershipUpdate.count === 0) {
        throw new ValidationError(
          "Ownership was already transferred by another request",
        );
      }

      const transferredWorkspace = await tx.workspace.findUniqueOrThrow({
        where: {
          id: workspaceId,
        },
      });

      await tx.workspaceMember.update({
        where: {
          id: actorMembership.id,
        },
        data: {
          role: WorkspaceRole.ADMIN,
        },
      });

      const newOwnerMembership = await tx.workspaceMember.update({
        where: {
          id: targetMember.id,
        },
        data: {
          role: WorkspaceRole.OWNER,
        },
      });

      return { transferredWorkspace, newOwnerMembership };
    });

  // Best-effort: ownership has already changed at this point, so a failure
  // here must not fail the request - unlike a create-mutation's activity log,
  // a retry can't "transfer again" (the actor is no longer the owner), it
  // would just surface a confusing "forbidden" error for a transfer that
  // already succeeded. Each side effect is independent: one failing must not
  // prevent the others from running.
  try {
    await createActivity({
      workspaceId: transferredWorkspace.id,
      actorId,

      type: ActivityType.OWNERSHIP_TRANSFERRED,

      entityType: ActivityEntityType.WORKSPACE,
      entityId: transferredWorkspace.id,

      metadata: {
        workspaceName: transferredWorkspace.name,
        newOwnerId: newOwnerMembership.userId,
        newOwnerName: targetMember.user.name,
      },
    });
  } catch (error) {
    // Best-effort: ownership has already transferred - only the audit-log
    // entry for it failed to be recorded.
    logger.warn({ err: error, workspaceId: transferredWorkspace.id }, "Failed to record ownership-transfer activity");
  }

  try {
    await enqueueNotification({
      workspaceId: transferredWorkspace.id,
      recipientId: newOwnerMembership.userId,

      type: NotificationType.OWNERSHIP_TRANSFERRED,

      title: "Workspace Ownership Transferred",
      message: `You are now the owner of "${transferredWorkspace.name}".`,

      // Ownership can legitimately transfer again later, including back to
      // this same recipient - workspaceId+recipientId alone would collide
      // with that future transfer. updatedAt is bumped by the updateMany
      // above (Prisma's @updatedAt on Workspace), so it's a real, already-
      // persisted marker of THIS specific transfer, not a timestamp invented
      // just for uniqueness.
      eventId: `${transferredWorkspace.id}-${transferredWorkspace.updatedAt.getTime()}`,

      metadata: {
        workspaceId: transferredWorkspace.id,
        previousOwnerId: actorId,
      },
    });
  } catch (error) {
    // Best-effort: ownership has already transferred - only the
    // notification about it failed to be enqueued.
    logger.warn({ err: error, workspaceId: transferredWorkspace.id }, "Failed to enqueue ownership-transfer notification");
  }

  try {
    emitToWorkspace(
      transferredWorkspace.id,
      REALTIME_EVENTS.OWNERSHIP_TRANSFERRED,
      {
        workspaceId: transferredWorkspace.id,
        previousOwnerId: actorId,
        newOwnerId: newOwnerMembership.userId,
      },
    );
  } catch (error) {
    // Best-effort: ownership has already transferred - only the live push
    // failed. Clients will still see the new owner on their next fetch.
    logger.warn({ err: error, workspaceId: transferredWorkspace.id }, "Failed to emit ownership-transfer realtime event");
  }

  return {
    workspaceId: transferredWorkspace.id,
    workspaceName: transferredWorkspace.name,
    previousOwnerId: actorId,
    newOwnerId: newOwnerMembership.userId,
    newOwnerName: targetMember.user.name,
    newOwnerEmail: targetMember.user.email,
  };
}

export async function leaveWorkspace(actorId: string, workspaceId: string) {
  const membership = await requireWorkspaceMembership(workspaceId, actorId);

  const workspace = await getWorkspaceById(workspaceId);

  if (membership.userId === workspace.ownerId) {
    throw new ValidationError(
      "Workspace owners cannot leave. Transfer ownership to another member before leaving.",
    );
  }

  await prisma.workspaceMember.delete({
    where: {
      id: membership.id,
    },
  });

  // Best-effort: the membership is already gone at this point, so a failure
  // here must not fail the request - unlike a create-mutation's activity log,
  // a retry can't "leave again," it would just surface a confusing
  // "not a member" error for a leave that already succeeded.
  try {
    await createActivity({
      workspaceId,
      actorId,

      type: ActivityType.MEMBER_LEFT,

      entityType: ActivityEntityType.MEMBER,
      entityId: membership.id,

      metadata: {
        workspaceName: workspace.name,
      },
    });

    emitToWorkspace(workspaceId, REALTIME_EVENTS.MEMBER_LEFT, {
      workspaceId,
      userId: actorId,
      memberId: membership.id,
    });
  } catch (error) {
    // Best-effort: the membership is already gone - only the audit-log
    // entry (and the realtime emit alongside it, above) failed.
    logger.warn({ err: error, workspaceId }, "Failed to record leave-workspace activity");
  }

  // Best-effort and independent of the activity/emit block above - one
  // failing must not prevent the other from running. Covers a device/tab
  // other than the one that issued this request (the frontend's own
  // client-side disconnect/reconnect only reaches the socket that made
  // this call). See removeWorkspaceMember's matching comment above - this
  // branch isn't reachable in practice today, same reasoning applies here.
  try {
    await evictFromWorkspace(workspaceId, actorId);
  } catch (error) {
    logger.error(
      { err: error, workspaceId, userId: actorId },
      "SECURITY: failed to evict leaving member's other sockets after retries - they " +
        "may continue receiving this workspace's realtime events until their socket " +
        "next disconnects/reconnects",
    );
  }
}
