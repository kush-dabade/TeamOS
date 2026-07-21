import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { archiveProject } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem } from "../types";

export function useArchiveProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectListItem, AppError, string>({
    mutationFn: (projectId: string) => archiveProject(projectId),
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
