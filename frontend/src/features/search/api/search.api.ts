import { apiClient, type ApiSuccess } from "@/lib/api";
import type { TaskPriority, TaskStatus } from "@/features/tasks";

import type { SearchProject, SearchResults, SearchTask } from "../types";

interface BackendSearchProject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface BackendSearchTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
}

interface BackendSearchResponse {
  query: string;
  projects: BackendSearchProject[];
  tasks: BackendSearchTask[];
}

function toSearchProject(project: BackendSearchProject): SearchProject {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
  };
}

function toSearchTask(task: BackendSearchTask): SearchTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    projectId: task.projectId,
  };
}

export interface SearchParams {
  workspaceId: string;
  query: string;
  limit?: number;
}

export interface FetchSearchOptions {
  signal?: AbortSignal;
}

export async function fetchSearch(
  { workspaceId, query, limit }: SearchParams,
  options?: FetchSearchOptions,
): Promise<SearchResults> {
  const response = await apiClient.get<ApiSuccess<BackendSearchResponse>>("/search", {
    params: { workspaceId, q: query, limit },
    signal: options?.signal,
  });

  const { data } = response.data;

  return {
    query: data.query,
    projects: data.projects.map(toSearchProject),
    tasks: data.tasks.map(toSearchTask),
  };
}
