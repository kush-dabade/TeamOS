import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { fetchProjectTasks } from "@/features/tasks/api/tasks.api";
import { taskKeys } from "@/features/tasks/lib/task-keys";
import type { AppError } from "@/lib/api";

import { countTasks } from "../lib/task-counts";
import type { ProjectListItem, ProjectStatus } from "../types";

import { useProjects } from "./use-projects";

// The backend Project resource has no aggregated task-count fields, so counts
// are computed client-side. Task queries are fanned out per project returned
// by `projectsQuery` (rather than composing the Tasks feature's workspace-wide
// `useTasks`), because that hook fetches its own project list without a
// status filter - which the backend defaults to excluding archived projects
// from - so it never fetches tasks for an archived project and its counts
// would silently read as 0/0.
export function useProjectsWithTaskCounts(workspaceId: string | undefined, status?: ProjectStatus) {
  const projectsQuery = useProjects(workspaceId, status);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  // Task counts need every task, not one page of them - requests the
  // paginated endpoint's max page size rather than page-walking. Projects
  // beyond 100 tasks are a known, accepted gap (same limitation accepted for
  // the All Tasks page's fan-out - see use-tasks.ts).
  const taskQueries = useQueries({
    queries: projects.map(({ project }) => ({
      queryKey: taskKeys.listPage(project.id, 1, 100),
      queryFn: () => fetchProjectTasks(project.id, { limit: 100 }),
      enabled: Boolean(workspaceId),
    })),
  });

  const data = useMemo<ProjectListItem[] | undefined>(() => {
    if (!projectsQuery.data) {
      return undefined;
    }

    return projects.map((item, index) => ({
      ...item,
      ...countTasks(taskQueries[index]?.data?.tasks ?? []),
    }));
  }, [projectsQuery.data, projects, taskQueries]);

  const isLoading =
    projectsQuery.isLoading ||
    (projects.length > 0 && taskQueries.some((query) => query.isLoading));
  const isError = projectsQuery.isError || taskQueries.some((query) => query.isError);
  const error =
    projectsQuery.error ??
    (taskQueries.find((query) => query.error)?.error as AppError | undefined) ??
    null;

  const refetch = () => {
    projectsQuery.refetch();
    taskQueries.forEach((query) => query.refetch());
  };

  return { data, isLoading, isError, error, refetch };
}
