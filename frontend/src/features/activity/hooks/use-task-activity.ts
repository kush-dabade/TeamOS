import { useInfiniteQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaceActivities, type ListActivitiesResult } from "../api/activity.api";
import { activityKeys } from "../lib/activity-keys";

// Offset-paginated feed (page/limit, unlike Notification's cursor design),
// but consumed the same way: useInfiniteQuery keeps every fetched page under
// the single activityKeys.list() cache entry (no page in the key), so
// realtime invalidation (realtime-handlers.ts) keeps targeting the same key
// unchanged and refetches every loaded page. Flattening into a plain
// Activity[] happens in the consuming component (TaskActivity), same
// boundary as NotificationsPopover for the Notification feed.
export function useTaskActivity(
  workspaceId: string | undefined,
  taskId: string | undefined,
) {
  return useInfiniteQuery<ListActivitiesResult, AppError>({
    queryKey: activityKeys.list(workspaceId ?? "", "TASK", taskId ?? ""),
    queryFn: ({ pageParam }) =>
      fetchWorkspaceActivities(workspaceId as string, {
        taskId: taskId as string,
        page: pageParam as number,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.pages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });
}
