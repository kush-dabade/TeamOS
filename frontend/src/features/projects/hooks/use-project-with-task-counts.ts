import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProjectTasks, type ListProjectTasksResult } from "@/features/tasks/api/tasks.api";
import { taskKeys } from "@/features/tasks/lib/task-keys";
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
  //
  // Caches the full ListProjectTasksResult (not just its .tasks array) -
  // this queryKey is also populated by use-projects-with-task-counts.ts
  // (the Projects list) and SprintsView.tsx with that same full shape, so
  // extracting .tasks inside the queryFn here would let whichever of those
  // fetches lands first silently poison this cache entry for the other:
  // countTasks() would receive a {tasks, pagination} object instead of an
  // array and throw "tasks.filter is not a function" the moment this page
  // read a cache entry the Projects list had already warmed.
  const tasksQuery = useQuery<ListProjectTasksResult, AppError>({
    queryKey: taskKeys.listPage(projectId ?? "", 1, 100),
    queryFn: () => fetchProjectTasks(projectId as string, { limit: 100 }),
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
        ...countTasks(tasksQuery.data?.tasks ?? []),
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
