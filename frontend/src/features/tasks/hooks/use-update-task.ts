import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";
// Direct module path, not the "@/features/sprints" barrel - see the note in
// TaskWorkspacePage.tsx. This file lives inside the tasks feature itself, and
// the sprints barrel re-exports components that import taskKeys from
// "@/features/tasks" at runtime, which would create a circular dependency.
import { sprintKeys } from "@/features/sprints/lib/sprint-keys";

import { updateTask, type UpdateTaskInput } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import type { Task } from "../types";

interface UpdateTaskVariables {
  taskId: string;
  input: UpdateTaskInput;
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, AppError, UpdateTaskVariables>({
    mutationFn: ({ taskId, input }) => updateTask(taskId, input),
    onSuccess: (task, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.list(task.projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.workspaceLists() });

      // sprintId can't change via this endpoint (not part of UpdateTaskInput -
      // reassignment is its own sprint-task endpoint), so there is no
      // "previous sprint" case to handle here, unlike sprint assign/remove.
      if (task.sprintId) {
        queryClient.invalidateQueries({ queryKey: sprintKeys.tasks(task.sprintId) });
      }
    },
  });
}
