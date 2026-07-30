import type { ActivityEntityType } from "../types";

export const activityKeys = {
  all: ["activity"] as const,
  lists: () => [...activityKeys.all, "list"] as const,
  list: (workspaceId: string, entityType: ActivityEntityType, entityId: string) =>
    [...activityKeys.lists(), workspaceId, entityType, entityId] as const,
};
