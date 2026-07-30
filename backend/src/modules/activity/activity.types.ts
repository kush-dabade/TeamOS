import {
  ActivityEntityType,
  ActivityType,
} from "../../generated/prisma/enums.js";

export type ActivityActor = {
  id: string;
  name: string;
  image: string | null;
};

export type ActivityResponse = {
  id: string;

  type: ActivityType;

  entityType: ActivityEntityType;
  entityId: string;

  metadata: Record<string, unknown> | null;

  createdAt: Date;

  actor: ActivityActor;
};

export type ListActivitiesResult = {
  activities: ActivityResponse[];
  total: number;
};

export interface CreateActivityData {
  workspaceId: string;
  actorId: string;

  type: ActivityType;

  entityType: ActivityEntityType;
  entityId: string;

  metadata?: Record<string, unknown>;
}

export interface ListActivitiesOptions {
  workspaceId: string;

  page: number;
  limit: number;

  entityType?: ActivityEntityType;
  entityId?: string;
}

type ActivityWithActor = {
  id: string;

  type: string;

  entityType: string;
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

    type: activity.type as ActivityResponse["type"],

    entityType: activity.entityType as ActivityResponse["entityType"],

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
