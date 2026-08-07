import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";
import type { Task } from "@/features/tasks";

import { fetchSprintTasks } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";

export function useSprintTasks(sprintId: string | undefined) {
  return useQuery<Task[], AppError>({
    queryKey: sprintKeys.tasks(sprintId ?? ""),
    queryFn: () => fetchSprintTasks(sprintId as string),
    enabled: Boolean(sprintId),
  });
}
