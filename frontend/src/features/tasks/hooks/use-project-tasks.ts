import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchProjectTasks } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import type { Task } from "../types";

export function useProjectTasks(projectId: string | undefined) {
  return useQuery<Task[], AppError>({
    queryKey: taskKeys.list(projectId ?? ""),
    queryFn: () => fetchProjectTasks(projectId as string),
    enabled: Boolean(projectId),
  });
}
