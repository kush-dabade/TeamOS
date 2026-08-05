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

  taskId: string | null;
  projectId: string | null;

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

  taskId?: string;
  projectId?: string;

  metadata?: Record<string, unknown>;
}

export interface ListActivitiesOptions {
  workspaceId: string;

  page: number;
  limit: number;

  entityType?: ActivityEntityType;
  entityId?: string;

  taskId?: string;
  projectId?: string;
}
