import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";
import { taskKeys, type Task } from "@/features/tasks";

import { removeTaskFromSprint } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";

interface RemoveTaskFromSprintVariables {
  sprintId: string;
  taskId: string;
  projectId: string;
}

// Same invalidation/toast rationale as useAssignTaskToSprint.
export function useRemoveTaskFromSprint() {
  const queryClient = useQueryClient();

  return useMutation<Task, AppError, RemoveTaskFromSprintVariables>({
    mutationFn: ({ sprintId, taskId }) => removeTaskFromSprint(sprintId, taskId),
    onSuccess: (_task, { sprintId, taskId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.tasks(sprintId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
