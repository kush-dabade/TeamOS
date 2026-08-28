import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";
// Direct module path, not the "@/features/sprints" barrel - see the note in
// TaskWorkspacePage.tsx. This file lives inside the tasks feature itself, and
// the sprints barrel re-exports components that import taskKeys from
// "@/features/tasks" at runtime, which would create a circular dependency.
import { sprintKeys } from "@/features/sprints/lib/sprint-keys";

import { deleteTask } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";

interface DeleteTaskVariables {
  taskId: string;
  projectId: string;
  // The delete endpoint returns no body, so unlike useUpdateTask this can't
  // be read off the mutation response - callers pass the task's current
  // sprintId (already in scope wherever a task is deleted) the same way they
  // already pass projectId.
  sprintId: string | null;
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, DeleteTaskVariables>({
    mutationFn: ({ taskId }) => deleteTask(taskId),
    onSuccess: (_data, { taskId, projectId, sprintId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.workspaceLists() });

      if (sprintId) {
        queryClient.invalidateQueries({ queryKey: sprintKeys.tasks(sprintId) });
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
