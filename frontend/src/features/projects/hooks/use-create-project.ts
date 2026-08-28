import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { createProject, type CreateProjectInput } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem } from "../types";

// No onError toast: project creation is form-backed (mirrors useCreateTask /
// useCreateSprint) - ProjectForm's own try/catch surfaces the failure inline
// via form.setError("root"), so a toast here would double-report the error.
export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<ProjectListItem, AppError, CreateProjectInput>({
    mutationFn: (input: CreateProjectInput) => createProject(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
