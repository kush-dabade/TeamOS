import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchSprint } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";
import type { Sprint } from "../types";

export function useSprint(sprintId: string | undefined) {
  return useQuery<Sprint, AppError>({
    queryKey: sprintKeys.detail(sprintId ?? ""),
    queryFn: () => fetchSprint(sprintId as string),
    enabled: Boolean(sprintId),
  });
}
