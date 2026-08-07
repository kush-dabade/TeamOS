import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchProjectSprints } from "../api/sprints.api";
import { sprintKeys } from "../lib/sprint-keys";
import type { Sprint } from "../types";

export function useSprints(projectId: string | undefined) {
  return useQuery<Sprint[], AppError>({
    queryKey: sprintKeys.list(projectId ?? ""),
    queryFn: () => fetchProjectSprints(projectId as string),
    enabled: Boolean(projectId),
  });
}
