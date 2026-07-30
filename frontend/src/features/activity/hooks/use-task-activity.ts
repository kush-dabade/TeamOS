import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaceActivities } from "../api/activity.api";
import { activityKeys } from "../lib/activity-keys";
import type { Activity } from "../types";

interface UseTaskActivityResult {
  data: Activity[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useTaskActivity(
  workspaceId: string | undefined,
  taskId: string | undefined,
): UseTaskActivityResult {
  const activityQuery = useQuery<Activity[], AppError>({
    queryKey: activityKeys.list(workspaceId ?? "", "TASK", taskId ?? ""),
    queryFn: async () => {
      const result = await fetchWorkspaceActivities(workspaceId as string, {
        entityType: "TASK",
        entityId: taskId as string,
      });

      return result.activities;
    },
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });

  const refetch = () => {
    activityQuery.refetch();
  };

  return {
    data: activityQuery.data ?? [],
    isLoading: activityQuery.isLoading,
    isError: activityQuery.isError,
    refetch,
  };
}
