import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";
import { useActiveWorkspace } from "@/features/workspaces";
import { activityKeys, fetchWorkspaceActivities, type Activity } from "@/features/activity";

interface UseRecentActivityResult {
  data: Activity[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const RECENT_ACTIVITY_LIMIT = 6;

// Data boundary for the Recent Activity panel. Consumes the canonical
// Activity feature's workspace-wide feed (fetchWorkspaceActivities with no
// entityType/entityId filter) rather than a project/task-scoped hook -
// this is the one panel that needs "every activity in the workspace,"
// which use-project-activity/use-task-activity don't provide.
export function useRecentActivity(): UseRecentActivityResult {
  const { workspaceId } = useActiveWorkspace();

  const activityQuery = useQuery<Activity[], AppError>({
    queryKey: activityKeys.workspaceFeed(workspaceId ?? ""),
    queryFn: async () => {
      const result = await fetchWorkspaceActivities(workspaceId as string, {
        limit: RECENT_ACTIVITY_LIMIT,
      });
      return result.activities;
    },
    enabled: Boolean(workspaceId),
  });

  const isLoading = activityQuery.isLoading;
  const isError = activityQuery.isError;

  const refetch = () => {
    activityQuery.refetch();
  };

  return { data: activityQuery.data ?? [], isLoading, isError, refetch };
}
