import { apiClient, type ApiSuccess } from "@/lib/api";
import type { TaskPriority, TaskStatus } from "@/features/tasks";
import type { SprintStatus } from "@/features/sprints";
import type { WorkspaceRole } from "@/features/workspaces";

import type {
  SearchMember,
  SearchProject,
  SearchResults,
  SearchSprint,
  SearchTask,
} from "../types";

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

interface BackendSearchSprint {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  projectId: string;
}

interface BackendSearchMember {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: WorkspaceRole;
}

interface BackendSearchResponse {
  query: string;
  projects: BackendSearchProject[];
  tasks: BackendSearchTask[];
  sprints: BackendSearchSprint[];
  members: BackendSearchMember[];
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

function toSearchSprint(sprint: BackendSearchSprint): SearchSprint {
  return {
    id: sprint.id,
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status,
    projectId: sprint.projectId,
  };
}

function toSearchMember(member: BackendSearchMember): SearchMember {
  return {
    userId: member.userId,
    name: member.name,
    email: member.email,
    image: member.image,
    role: member.role,
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
    sprints: data.sprints.map(toSearchSprint),
    members: data.members.map(toSearchMember),
  };
}
