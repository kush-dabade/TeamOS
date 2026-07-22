import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProjectTasks } from "@/features/tasks/api/tasks.api";
import { taskKeys } from "@/features/tasks/lib/task-keys";
import type { Task } from "@/features/tasks/types";
import type { AppError } from "@/lib/api";

import { countTasks } from "../lib/task-counts";
import type { ProjectDetail } from "../types";

import { useProject } from "./use-project";

// Fetches this project's tasks directly (rather than composing the Tasks
// feature's workspace-wide `useTasks`, which fetches its own project list
// without a status filter - excluding archived projects by backend default -
// and would never fetch tasks for an archived project, silently reporting
// its progress as 0/0).
export function useProjectWithTaskCounts(projectId: string | undefined) {
  const projectQuery = useProject(projectId);

  const tasksQuery = useQuery<Task[], AppError>({
    queryKey: taskKeys.list(projectId ?? ""),
    queryFn: () => fetchProjectTasks(projectId as string),
    enabled: Boolean(projectId),
  });

  const data = useMemo<ProjectDetail | undefined>(() => {
    if (!projectQuery.data) {
      return undefined;
    }

    return {
      ...projectQuery.data,
      project: {
        ...projectQuery.data.project,
        ...countTasks(tasksQuery.data ?? []),
      },
    };
  }, [projectQuery.data, tasksQuery.data]);

  const isLoading =
    projectQuery.isLoading || (Boolean(projectQuery.data) && tasksQuery.isLoading);
  const isError = projectQuery.isError || tasksQuery.isError;
  const error = projectQuery.error ?? tasksQuery.error ?? null;

  const refetch = () => {
    projectQuery.refetch();
    tasksQuery.refetch();
  };

  return { data, isLoading, isError, error, refetch };
}
