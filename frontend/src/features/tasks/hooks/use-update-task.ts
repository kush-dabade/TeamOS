import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

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
    },
  });
}
