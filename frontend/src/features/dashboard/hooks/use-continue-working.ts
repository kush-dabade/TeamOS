import { useMemo } from "react";

import { useProjects } from "@/features/projects";
import { useActiveWorkspace } from "@/features/workspaces";

import type { ContinueWorkingItem } from "../types";

interface UseContinueWorkingResult {
  data: ContinueWorkingItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Data boundary for the dashboard "Continue Working" panel.
 *
 * Composes the Projects feature's `useProjects` query rather than owning any
 * fetch of its own. The backend has no per-user "recently active project"
 * signal, so `project.updatedAt` is used as the recency proxy (mirrors the
 * assumption the prior mock data documented).
 */
export function useContinueWorking(): UseContinueWorkingResult {
  const { workspaceId } = useActiveWorkspace();
  const projectsQuery = useProjects(workspaceId ?? undefined);

  const data = useMemo<ContinueWorkingItem[]>(() => {
    return [...(projectsQuery.data ?? [])]
      .sort(
        (a, b) => new Date(b.project.updatedAt).getTime() - new Date(a.project.updatedAt).getTime(),
      )
      .map(({ project }) => ({
        id: project.id,
        slug: project.slug,
        name: project.name,
        status: project.status,
        lastActivityAt: project.updatedAt,
      }));
  }, [projectsQuery.data]);

  const isLoading = projectsQuery.isLoading;
  const isError = projectsQuery.isError;

  const refetch = () => {
    projectsQuery.refetch();
  };

  return { data, isLoading, isError, refetch };
}
