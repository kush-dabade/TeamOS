import type { ActivityEntityType } from "../types";

export const activityKeys = {
  all: ["activity"] as const,
  lists: () => [...activityKeys.all, "list"] as const,
  list: (workspaceId: string, entityType: ActivityEntityType, entityId: string) =>
    [...activityKeys.lists(), workspaceId, entityType, entityId] as const,
  // Separate branch, not nested under lists() - a sibling, not a prefix, of
  // every entity-scoped list() key. If this were `[...lists(), workspaceId]`
  // it would be a prefix of `list(workspaceId, entityType, entityId)` for
  // every entity in that workspace, so invalidating it would over-invalidate
  // every project/task activity feed workspace-wide. Mirrors the same
  // "separate branch" pattern as taskKeys.workspaceLists() in task-keys.ts.
  workspaceFeed: (workspaceId: string) =>
    [...activityKeys.all, "workspace-feed", workspaceId] as const,
};
