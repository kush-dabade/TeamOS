import type { WorkspaceAttentionItem } from "../types";

import { mockWorkspaceAttention } from "../data/dashboard.mock";

interface UseWorkspaceAttentionResult {
  data: WorkspaceAttentionItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Data boundary for the dashboard "Workspace Attention" panel.
 *
 * Currently backed by mock data. The return shape mirrors a TanStack Query
 * `useQuery` result, so integration is a change inside this hook (swap the body
 * for a query against the tasks API) without touching any consuming component.
 */
export function useWorkspaceAttention(): UseWorkspaceAttentionResult {
  return {
    data: mockWorkspaceAttention,
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}
