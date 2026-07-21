import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";
import { useProjects } from "@/features/projects";
import { useWorkspaceMembers } from "@/features/workspaces";

import { fetchProjectTasks } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import type { TaskListItem, TaskProject } from "../types";

// There is no workspace-wide "list all tasks" endpoint - only
// GET /projects/:projectId/tasks. To preserve the existing all-tasks page
// UX without adding a new backend endpoint, this fans out one task-list
// query per project in the workspace and merges the results client-side.
export function useTasks(workspaceId: string | undefined) {
  const projectsQuery = useProjects(workspaceId);
  const membersQuery = useWorkspaceMembers(workspaceId);

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const taskQueries = useQueries({
    queries: projects.map(({ project }) => ({
      queryKey: taskKeys.list(project.id),
      queryFn: () => fetchProjectTasks(project.id),
      enabled: Boolean(workspaceId),
    })),
  });

  const isLoading =
    projectsQuery.isLoading ||
    membersQuery.isLoading ||
    (projects.length > 0 && taskQueries.some((query) => query.isLoading));

  const error =
    projectsQuery.error ??
    membersQuery.error ??
    (taskQueries.find((query) => query.error)?.error as AppError | undefined) ??
    null;

  const tasks = useMemo<TaskListItem[]>(() => {
    if (!membersQuery.data) {
      return [];
    }

    const assigneesByUserId = new Map(
      membersQuery.data.map((member) => [member.userId, { id: member.userId, name: member.name }]),
    );

    const items = projects.flatMap(({ project }, index): TaskListItem[] => {
      const taskProject: TaskProject = { id: project.id, slug: project.slug, name: project.name };
      const projectTasks = taskQueries[index]?.data ?? [];

      return projectTasks.map((task) => ({
        task,
        assignee: task.assigneeId ? (assigneesByUserId.get(task.assigneeId) ?? null) : null,
        project: taskProject,
      }));
    });

    return items.sort(
      (first, second) =>
        new Date(second.task.updatedAt).getTime() - new Date(first.task.updatedAt).getTime(),
    );
  }, [projects, taskQueries, membersQuery.data]);

  const refetch = () => {
    projectsQuery.refetch();
    membersQuery.refetch();
    taskQueries.forEach((query) => query.refetch());
  };

  return { tasks, isLoading, error, refetch };
}
