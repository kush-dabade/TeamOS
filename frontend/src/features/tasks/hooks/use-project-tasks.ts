import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchProjectTasks, type ListProjectTasksResult } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";

const DEFAULT_LIMIT = 20;

// Page state lives in the consuming component, not here - this hook is a
// data source, the same convention TasksPage already follows for filters.
export function useProjectTasks(projectId: string | undefined, page = 1) {
  return useQuery<ListProjectTasksResult, AppError>({
    queryKey: taskKeys.listPage(projectId ?? "", page, DEFAULT_LIMIT),
    queryFn: () => fetchProjectTasks(projectId as string, { page, limit: DEFAULT_LIMIT }),
    enabled: Boolean(projectId),
  });
}
