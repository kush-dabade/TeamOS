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

  // Task counts need every task, not one page of them - requests the
  // paginated endpoint's max page size rather than page-walking. Projects
  // beyond 100 tasks are a known, accepted gap (same limitation accepted for
  // the All Tasks page's fan-out - see use-tasks.ts).
  const tasksQuery = useQuery<Task[], AppError>({
    queryKey: taskKeys.listPage(projectId ?? "", 1, 100),
    queryFn: async () => (await fetchProjectTasks(projectId as string, { limit: 100 })).tasks,
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
