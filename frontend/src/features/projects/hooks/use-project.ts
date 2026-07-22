import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchProject } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectDetail } from "../types";

export function useProject(projectId: string | undefined) {
  return useQuery<ProjectDetail, AppError>({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => fetchProject(projectId as string),
    enabled: Boolean(projectId),
  });
}
