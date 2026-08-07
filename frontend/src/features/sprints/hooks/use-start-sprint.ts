import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { startSprint } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";
import type { Sprint } from "../types";

interface StartSprintVariables {
  sprintId: string;
  projectId: string;
}

// Unlike create/update, this is a direct one-click action with no form to
// show an inline error, so the hook owns the toast (mirrors
// useArchiveProject/useDeleteTask). It surfaces the backend's own state-
// machine message (e.g. "Another active sprint already exists for this
// project") verbatim.
export function useStartSprint() {
  const queryClient = useQueryClient();

  return useMutation<Sprint, AppError, StartSprintVariables>({
    mutationFn: ({ sprintId }) => startSprint(sprintId),
    onSuccess: (_sprint, { sprintId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(sprintId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
