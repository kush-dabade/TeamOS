import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { transferProjectOwnership } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem } from "../types";

export function useTransferProjectOwnership(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<ProjectListItem, AppError, string>({
    mutationFn: (newOwnerId) => transferProjectOwnership(projectId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
