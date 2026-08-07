import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { updateSprint, type UpdateSprintInput } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";
import type { Sprint } from "../types";

interface UpdateSprintVariables {
  sprintId: string;
  projectId: string;
  input: UpdateSprintInput;
}

// No onError toast, for the same reason as useCreateSprint: this backs an
// edit form, which already has its own inline error slot.
export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation<Sprint, AppError, UpdateSprintVariables>({
    mutationFn: ({ sprintId, input }) => updateSprint(sprintId, input),
    onSuccess: (_sprint, { sprintId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(sprintId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
    },
  });
}
