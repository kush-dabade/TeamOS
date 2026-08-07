import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { createSprint, type CreateSprintInput } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";
import type { Sprint } from "../types";

// No onError toast: sprint creation is form-backed (mirrors useCreateTask,
// not useCreateProject) — the eventual SprintForm's own try/catch surfaces
// the failure inline via form.setError("root"), the same way TaskForm and
// ProjectForm do, so a toast here would double-report the same error.
export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<Sprint, AppError, CreateSprintInput>({
    mutationFn: (input: CreateSprintInput) => createSprint(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
    },
  });
}
