import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchProjects } from "../api/projects.api";
import { projectKeys } from "../lib/project-keys";
import type { ProjectListItem, ProjectStatus } from "../types";

export function useProjects(workspaceId: string | undefined, status?: ProjectStatus) {
  return useQuery<ProjectListItem[], AppError>({
    queryKey: projectKeys.list(workspaceId ?? "", status),
    queryFn: () => fetchProjects(workspaceId as string, status),
    enabled: Boolean(workspaceId),
  });
}
