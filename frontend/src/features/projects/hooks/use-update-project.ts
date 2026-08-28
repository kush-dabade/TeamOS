import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { updateProject, type UpdateProjectInput } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem } from "../types";

interface UpdateProjectVariables {
  projectId: string;
  input: UpdateProjectInput;
}

// No onError toast, for the same reason as useCreateProject: this backs
// ProjectForm's edit flow, which already has its own inline error slot.
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectListItem, AppError, UpdateProjectVariables>({
    mutationFn: ({ projectId, input }: UpdateProjectVariables) => updateProject(projectId, input),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
