import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { updateProject, type UpdateProjectInput } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem } from "../types";

interface UpdateProjectVariables {
  projectId: string;
  input: UpdateProjectInput;
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectListItem, AppError, UpdateProjectVariables>({
    mutationFn: ({ projectId, input }: UpdateProjectVariables) => updateProject(projectId, input),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
