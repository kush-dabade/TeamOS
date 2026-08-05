import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError } from "../../shared/errors/forbidden-error.js";

import type {
  ActivityResponse,
  CreateActivityData,
  ListActivitiesOptions,
  ListActivitiesResult,
} from "./activity.types.js";

import { emitToWorkspace } from "../../realtime/realtime.emitter.js";
import { REALTIME_EVENTS } from "../../realtime/realtime.constants.js";

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

type ActivityWithActor = {
  id: string;

  type: ActivityResponse["type"];

  entityType: ActivityResponse["entityType"];
  entityId: string;

  metadata: Record<string, unknown> | null;

  createdAt: Date;

  actor: {
    id: string;
    name: string;
    image: string | null;
  };
};

function toActivityResponse(activity: ActivityWithActor): ActivityResponse {
  return {
    id: activity.id,

    type: activity.type,

    entityType: activity.entityType,
    entityId: activity.entityId,

    metadata: activity.metadata,

    createdAt: activity.createdAt,

    actor: {
      id: activity.actor.id,
      name: activity.actor.name,
      image: activity.actor.image,
    },
  };
}

export async function createActivity(data: CreateActivityData): Promise<void> {
  const activityData = {
    workspaceId: data.workspaceId,
    actorId: data.actorId,

    type: data.type,

    entityType: data.entityType,
    entityId: data.entityId,

    ...(data.taskId !== undefined && { taskId: data.taskId }),
    ...(data.projectId !== undefined && { projectId: data.projectId }),

    ...(data.metadata && {
      metadata: data.metadata as Prisma.InputJsonValue,
    }),
  };

  const activity = await prisma.activity.create({
    data: activityData,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  const response = toActivityResponse(activity as ActivityWithActor);

  emitToWorkspace(activity.workspaceId, REALTIME_EVENTS.ACTIVITY_CREATED, {
    workspaceId: activity.workspaceId,
    activity: response,
  });
}

export async function listWorkspaceActivities(
  actorId: string,
  options: ListActivitiesOptions,
): Promise<ListActivitiesResult> {
  const membership = await getWorkspaceMembership(options.workspaceId, actorId);

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  const skip = (options.page - 1) * options.limit;

  const where = {
    workspaceId: options.workspaceId,

    ...(options.entityType &&
      options.entityId && {
        entityType: options.entityType,
        entityId: options.entityId,
      }),

    ...(options.taskId && {
      taskId: options.taskId,
    }),

    ...(options.projectId && {
      projectId: options.projectId,
    }),
  };

  const [total, activities] = await Promise.all([
    prisma.activity.count({
      where,
    }),

    prisma.activity.findMany({
      where,

      include: {
        actor: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      skip,
      take: options.limit,
    }),
  ]);

  return {
    activities: activities.map((activity) =>
      toActivityResponse(activity as ActivityWithActor),
    ),

    total,
  };
}
