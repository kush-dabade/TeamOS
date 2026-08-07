import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { completeSprint } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";
import type { Sprint } from "../types";

interface CompleteSprintVariables {
  sprintId: string;
  projectId: string;
}

// Direct one-click action, same toast rationale as useStartSprint.
export function useCompleteSprint() {
  const queryClient = useQueryClient();

  return useMutation<Sprint, AppError, CompleteSprintVariables>({
    mutationFn: ({ sprintId }) => completeSprint(sprintId),
    onSuccess: (_sprint, { sprintId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(sprintId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
