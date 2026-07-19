import type { TaskListItem } from "@/features/tasks/types";

import { mockMyTasks } from "../data/dashboard.mock";

interface UseMyTasksResult {
  data: TaskListItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Data boundary for the dashboard "My Tasks" panel.
 *
 * Currently backed by mock data. The return shape mirrors a TanStack Query
 * `useQuery` result, so integration is a change inside this hook (swap the body
 * for a query against the tasks API) without touching any consuming component.
 */
export function useMyTasks(): UseMyTasksResult {
  return {
    data: mockMyTasks,
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}
