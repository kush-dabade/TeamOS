import type { ContinueWorkingItem } from "../types";

import { mockContinueWorking } from "../data/dashboard.mock";

interface UseContinueWorkingResult {
  data: ContinueWorkingItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Data boundary for the dashboard "Continue Working" panel.
 *
 * Currently backed by mock data. The return shape mirrors a TanStack Query
 * `useQuery` result, so integration is a change inside this hook (swap the body
 * for a query against the projects API, sorted by recency) without touching any
 * consuming component.
 */
export function useContinueWorking(): UseContinueWorkingResult {
  return {
    data: mockContinueWorking,
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}
