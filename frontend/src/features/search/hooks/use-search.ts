import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchSearch } from "../api/search.api";
import { searchKeys } from "../lib/search-keys";
import type { SearchResults } from "../types";

interface UseSearchOptions {
  workspaceId: string | undefined;
  query: string;
  enabled?: boolean;
}

// When (and at what query length) a fetch should actually start is a UX
// decision for the consuming surface - the caller's `enabled` is expected to
// account for it (e.g. `open && query.length >= 2`). This hook only guards
// the one precondition it can't function without: a resolved workspace.
export function useSearch({ workspaceId, query, enabled = true }: UseSearchOptions) {
  const trimmedQuery = query.trim();

  return useQuery<SearchResults, AppError>({
    queryKey: searchKeys.results(workspaceId ?? "", trimmedQuery),
    queryFn: ({ signal }) =>
      fetchSearch({ workspaceId: workspaceId as string, query: trimmedQuery }, { signal }),
    enabled: enabled && Boolean(workspaceId),
  });
}
