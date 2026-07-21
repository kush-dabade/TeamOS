import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { createTask, type CreateTaskInput } from "../api/tasks.api";
import { taskKeys } from "../lib/task-keys";
import type { Task } from "../types";

interface CreateTaskVariables {
  projectId: string;
  input: CreateTaskInput;
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, AppError, CreateTaskVariables>({
    mutationFn: ({ projectId, input }) => createTask(projectId, input),
    onSuccess: (_task, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
    },
  });
}
