import { useMemo } from "react";

import { useAuth } from "@/features/auth";
import { useTasks } from "@/features/tasks";
import type { TaskListItem } from "@/features/tasks/types";
import { useActiveWorkspace } from "@/features/workspaces";

interface UseMyTasksResult {
  data: TaskListItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Data boundary for the dashboard "My Tasks" panel.
 *
 * Composes the Tasks feature's workspace-wide `useTasks` query, filtered to
 * tasks assigned to the signed-in user. There is no "tasks assigned to me"
 * backend endpoint, so filtering happens client-side over the same
 * workspace-wide task set the Tasks page fetches - shared via TanStack
 * Query's cache, so mounting both adds no extra network cost. `useTasks`
 * already sorts by `updatedAt` descending, so that ordering is preserved here
 * without re-sorting.
 */
export function useMyTasks(): UseMyTasksResult {
  const { user } = useAuth();
  const {
    activeWorkspaceId,
    isLoading: isWorkspaceLoading,
    isError: isWorkspaceError,
    refetch: refetchWorkspace,
  } = useActiveWorkspace();
  const tasksQuery = useTasks(activeWorkspaceId ?? undefined);

  const data = useMemo<TaskListItem[]>(() => {
    if (!user) {
      return [];
    }

    return tasksQuery.tasks.filter(
      ({ task }) => task.assigneeId === user.id && task.status !== "DONE",
    );
  }, [tasksQuery.tasks, user]);

  const isLoading = isWorkspaceLoading || (Boolean(activeWorkspaceId) && tasksQuery.isLoading);
  const isError = isWorkspaceError || Boolean(tasksQuery.error);

  const refetch = () => {
    refetchWorkspace();
    tasksQuery.refetch();
  };

  return { data, isLoading, isError, refetch };
}
