import type { RecentActivityItem } from "../types";

import { mockRecentActivity } from "../data/dashboard.mock";

interface UseRecentActivityResult {
  data: RecentActivityItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// Data boundary for the Recent Activity feed. Mirrors the `useQuery` return
// shape so swapping the mock for the existing
// `GET /api/v1/workspaces/:workspaceId/activity` endpoint is a one-file change:
// map `ActivityResponse` -> `RecentActivityItem` (Date -> ISO string) here.
export function useRecentActivity(): UseRecentActivityResult {
  return {
    data: mockRecentActivity,
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}
