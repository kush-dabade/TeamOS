import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";
import { useActiveWorkspace } from "@/features/workspaces";

import { fetchRecentActivity } from "../api/dashboard.api";
import { dashboardKeys } from "../lib/dashboard-keys";
import type { RecentActivityItem } from "../types";

interface UseRecentActivityResult {
  data: RecentActivityItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const RECENT_ACTIVITY_LIMIT = 6;

// Data boundary for the Recent Activity feed. No existing feature owns
// Activity data, so this is the one panel that queries the backend
// (`GET /workspaces/:workspaceId/activity`) through a dashboard-owned API
// module instead of composing another feature's hook.
export function useRecentActivity(): UseRecentActivityResult {
  const { workspaceId } = useActiveWorkspace();

  const activityQuery = useQuery<RecentActivityItem[], AppError>({
    queryKey: dashboardKeys.recentActivity(workspaceId ?? ""),
    queryFn: () => fetchRecentActivity(workspaceId as string, RECENT_ACTIVITY_LIMIT),
    enabled: Boolean(workspaceId),
  });

  const isLoading = activityQuery.isLoading;
  const isError = activityQuery.isError;

  const refetch = () => {
    activityQuery.refetch();
  };

  return { data: activityQuery.data ?? [], isLoading, isError, refetch };
}
