import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";
import { useProjects } from "@/features/projects";
import { useWorkspaceMembers } from "@/features/workspaces";

import { fetchWorkspaceTasks } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import type { Task, TaskListItem, TaskProject } from "../types";

// The max page size GET /workspaces/:workspaceId/tasks accepts - used here
// purely to minimize how many round trips fetchAllWorkspaceTasks needs, not
// as a ceiling: every page is walked to completion below, so a workspace
// with more tasks than this just takes more (parallel) requests, it never
// loses any.
const PAGE_LIMIT = 100;

/**
 * Fetches every task in the workspace by walking
 * GET /workspaces/:workspaceId/tasks to completion, rather than exposing
 * pagination state to callers - every current consumer (Tasks page,
 * dashboard widgets, sidebar My Tasks) filters/sorts over the complete set
 * client-side, not a paginated feed. The first page reveals the total page
 * count; any remaining pages are then fetched in parallel rather than
 * walked one at a time, so total latency stays roughly constant regardless
 * of how many pages a large workspace needs - a single call for a small
 * workspace, a bounded fan-out sized by actual task volume for a large one,
 * never a fan-out sized by project count the way the old implementation was.
 */
async function fetchAllWorkspaceTasks(workspaceId: string): Promise<Task[]> {
  const firstPage = await fetchWorkspaceTasks(workspaceId, { page: 1, limit: PAGE_LIMIT });

  if (firstPage.pagination.pages <= 1) {
    return firstPage.tasks;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pagination.pages - 1 }, (_, index) =>
      fetchWorkspaceTasks(workspaceId, { page: index + 2, limit: PAGE_LIMIT }),
    ),
  );

  return [...firstPage.tasks, ...remainingPages.flatMap((page) => page.tasks)];
}

export function useTasks(workspaceId: string | undefined) {
  const projectsQuery = useProjects(workspaceId);
  const membersQuery = useWorkspaceMembers(workspaceId);

  const tasksQuery = useQuery<Task[], AppError>({
    queryKey: taskKeys.workspaceList(workspaceId ?? ""),
    queryFn: () => fetchAllWorkspaceTasks(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const isLoading = projectsQuery.isLoading || membersQuery.isLoading || tasksQuery.isLoading;

  const error = projectsQuery.error ?? membersQuery.error ?? tasksQuery.error ?? null;

  const tasks = useMemo<TaskListItem[]>(() => {
    if (!membersQuery.data || !projectsQuery.data || !tasksQuery.data) {
      return [];
    }

    const assigneesByUserId = new Map(
      membersQuery.data.map((member) => [
        member.userId,
        { id: member.userId, name: member.name, image: member.image },
      ]),
    );

    const projectsById = new Map(
      projectsQuery.data.map(({ project }): [string, TaskProject] => [
        project.id,
        { id: project.id, slug: project.slug, name: project.name },
      ]),
    );

    const items: TaskListItem[] = [];

    for (const task of tasksQuery.data) {
      const project = projectsById.get(task.projectId);

      // A task's project can only be missing here if the project was
      // hard-deleted between these two queries resolving - Task.projectId
      // cascades on Project deletion, so a task can never outlive it.
      if (!project) {
        continue;
      }

      items.push({
        task,
        assignee: task.assigneeId ? (assigneesByUserId.get(task.assigneeId) ?? null) : null,
        project,
      });
    }

    return items.sort(
      (first, second) =>
        new Date(second.task.updatedAt).getTime() - new Date(first.task.updatedAt).getTime(),
    );
  }, [tasksQuery.data, projectsQuery.data, membersQuery.data]);

  const refetch = () => {
    projectsQuery.refetch();
    membersQuery.refetch();
    tasksQuery.refetch();
  };

  return { tasks, isLoading, error, refetch };
}
