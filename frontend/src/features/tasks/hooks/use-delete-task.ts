import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { deleteTask } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";

interface DeleteTaskVariables {
  taskId: string;
  projectId: string;
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, AppError, DeleteTaskVariables>({
    mutationFn: ({ taskId }) => deleteTask(taskId),
    onSuccess: (_data, { taskId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
    },
  });
}
