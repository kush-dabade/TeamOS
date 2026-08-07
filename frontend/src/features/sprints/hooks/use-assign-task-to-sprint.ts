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
// Task.sprintId changed. Only the target sprint is invalidated here - the
// REST response is the raw Task row and has no previousSprintId, so a task
// moved from another sprint can't have that sprint's task list invalidated
// from this onSuccess. Unlike this REST response, the realtime
// TASK_ASSIGNED_TO_SPRINT payload does carry previousSprintId, and
// emitToWorkspace broadcasts to the acting user's own socket too - so
// realtime-handlers.ts's handler for that event is what actually closes this
// gap, not this hook.
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
