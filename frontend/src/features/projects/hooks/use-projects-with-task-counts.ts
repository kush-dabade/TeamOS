import { useMemo } from "react";

import { useTasks, type TaskListItem } from "@/features/tasks";

import { countTasks } from "../lib/task-counts";
import type { ProjectListItem, ProjectStatus } from "../types";

import { useProjects } from "./use-projects";

// The backend Project resource has no aggregated task-count fields, so counts
// are computed client-side by composing the Tasks feature's workspace-wide
// `useTasks` query - the same composition approach the Dashboard uses for its
// panels, rather than a new per-project fetch.
export function useProjectsWithTaskCounts(workspaceId: string | undefined, status?: ProjectStatus) {
  const projectsQuery = useProjects(workspaceId, status);
  const tasksQuery = useTasks(workspaceId);

  const data = useMemo<ProjectListItem[] | undefined>(() => {
    if (!projectsQuery.data) {
      return undefined;
    }

    const tasksByProjectId = new Map<string, TaskListItem[]>();

    for (const item of tasksQuery.tasks) {
      const existing = tasksByProjectId.get(item.project.id);
      if (existing) {
        existing.push(item);
      } else {
        tasksByProjectId.set(item.project.id, [item]);
      }
    }

    return projectsQuery.data.map((item) => ({
      ...item,
      ...countTasks(tasksByProjectId.get(item.project.id) ?? []),
    }));
  }, [projectsQuery.data, tasksQuery.tasks]);

  const isLoading =
    projectsQuery.isLoading || (Boolean(projectsQuery.data) && tasksQuery.isLoading);
  const isError = projectsQuery.isError || Boolean(tasksQuery.error);
  const error = projectsQuery.error ?? tasksQuery.error ?? null;

  const refetch = () => {
    projectsQuery.refetch();
    tasksQuery.refetch();
  };

  return { data, isLoading, isError, error, refetch };
}
