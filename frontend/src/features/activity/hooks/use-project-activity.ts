import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchWorkspaceActivities } from "../api/activity.api";
import { activityKeys } from "../lib/activity-keys";
import type { Activity } from "../types";

interface UseProjectActivityResult {
  data: Activity[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useProjectActivity(
  workspaceId: string | undefined,
  projectId: string | undefined,
): UseProjectActivityResult {
  const activityQuery = useQuery<Activity[], AppError>({
    queryKey: activityKeys.list(workspaceId ?? "", "PROJECT", projectId ?? ""),
    queryFn: async () => {
      const result = await fetchWorkspaceActivities(workspaceId as string, {
        entityType: "PROJECT",
        entityId: projectId as string,
      });

      return result.activities;
    },
    enabled: Boolean(workspaceId) && Boolean(projectId),
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
