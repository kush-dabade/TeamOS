import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { createProject, type CreateProjectInput } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem } from "../types";

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<ProjectListItem, AppError, CreateProjectInput>({
    mutationFn: (input: CreateProjectInput) => createProject(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
