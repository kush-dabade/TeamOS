import type { QueryClient } from "@tanstack/react-query";

import { projectKeys } from "./project-keys";

/**
 * Project task counts (progress, "3 / 8 tasks") are part of the project list
 * and detail responses, so any task change in a project has to refresh those
 * queries too - not only the task lists. Lists are matched by prefix because
 * the status filter is part of their key.
 */
export function invalidateProjectTaskCounts(queryClient: QueryClient, projectId: string): void {
  queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
  queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
}
