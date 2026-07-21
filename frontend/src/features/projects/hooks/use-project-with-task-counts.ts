import { useMemo } from "react";

import { useTasks } from "@/features/tasks";

import { countTasks } from "../lib/task-counts";
import type { ProjectDetail } from "../types";

import { useProject } from "./use-project";

// Same composition approach as `useProjectsWithTaskCounts`, scoped to a
// single project: reuses the Tasks feature's workspace-wide `useTasks` query
// and filters it down, rather than introducing a per-project task fetch.
export function useProjectWithTaskCounts(
  projectId: string | undefined,
  workspaceId: string | undefined,
) {
  const projectQuery = useProject(projectId);
  const tasksQuery = useTasks(workspaceId);

  const data = useMemo<ProjectDetail | undefined>(() => {
    if (!projectQuery.data) {
      return undefined;
    }

    const projectTasks = tasksQuery.tasks.filter((item) => item.project.id === projectId);

    return {
      ...projectQuery.data,
      project: {
        ...projectQuery.data.project,
        ...countTasks(projectTasks),
      },
    };
  }, [projectQuery.data, tasksQuery.tasks, projectId]);

  const isLoading =
    projectQuery.isLoading || (Boolean(projectQuery.data) && tasksQuery.isLoading);
  const isError = projectQuery.isError || Boolean(tasksQuery.error);
  const error = projectQuery.error ?? tasksQuery.error ?? null;

  const refetch = () => {
    projectQuery.refetch();
    tasksQuery.refetch();
  };

  return { data, isLoading, isError, error, refetch };
}
