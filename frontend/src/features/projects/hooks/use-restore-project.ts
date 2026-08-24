import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { restoreProject } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem } from "../types";

export function useRestoreProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectListItem, AppError, string>({
    mutationFn: (projectId: string) => restoreProject(projectId),
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
