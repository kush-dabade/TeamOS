import { useInfiniteQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaceActivities, type ListActivitiesResult } from "../api/activity.api";
import { activityKeys } from "../lib/activity-keys";

// Offset-paginated feed (page/limit, unlike Notification's cursor design),
// but consumed the same way: useInfiniteQuery keeps every fetched page under
// the single activityKeys.list() cache entry (no page in the key), so
// realtime invalidation (realtime-handlers.ts) keeps targeting the same key
// unchanged and refetches every loaded page. Flattening into a plain
// Activity[] happens in the consuming component (ProjectActivity), same
// boundary as NotificationsPopover for the Notification feed.
export function useProjectActivity(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  return useInfiniteQuery<ListActivitiesResult, AppError>({
    queryKey: activityKeys.list(workspaceId ?? "", "PROJECT", projectId ?? ""),
    queryFn: ({ pageParam }) =>
      fetchWorkspaceActivities(workspaceId as string, {
        projectId: projectId as string,
        page: pageParam as number,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.pages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled: Boolean(workspaceId) && Boolean(projectId),
  });
}
