import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";
import { taskKeys, type Task } from "@/features/tasks";

import { assignTaskToSprint } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";

interface AssignTaskToSprintVariables {
  sprintId: string;
  taskId: string;
  projectId: string;
}

// Direct action (no form), so the hook owns the toast, same as
// useStartSprint/useCompleteSprint. Invalidates both sides of the
// relationship: the sprint's own task list (sprintKeys.tasks) and the Task's
// cached copies in the Tasks feature (taskKeys.detail/list), since
// Task.sprintId changed. Only the target sprint is invalidated - the REST
// response is the raw Task row and does not report which sprint (if any) the
// task was previously in, so a task moving sprint-to-sprint cannot also
// invalidate the *previous* sprint's task list from here. This mirrors the
// same limitation already accepted in realtime-handlers.ts's
// TASK_ASSIGNED_TO_SPRINT payload, which only carries the new sprintId too.
export function useAssignTaskToSprint() {
  const queryClient = useQueryClient();

  return useMutation<Task, AppError, AssignTaskToSprintVariables>({
    mutationFn: ({ sprintId, taskId }) => assignTaskToSprint(sprintId, taskId),
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
