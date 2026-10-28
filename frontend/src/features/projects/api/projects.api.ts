import { apiClient, type ApiSuccess } from "@/lib/api";

import type {
  ProjectDetail,
  ProjectListItem,
  ProjectStatus,
} from "../types";

interface BackendProject {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Present on list and detail responses; create/update responses omit it.
  taskCounts?: { total: number; completed: number };
}

interface BackendProjectDetail extends BackendProject {
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateProjectInput {
  ownerId: string;
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
}

// Task counts come from the project resource itself (computed server-side in
// one grouped query); responses without them - create and update - report
// 0/0/0% until the next list or detail fetch.
function toProjectListItem(project: BackendProject): ProjectListItem {
  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    ...toTaskCounts(project.taskCounts),
  };
}

function toTaskCounts(taskCounts: BackendProject["taskCounts"]) {
  const totalTaskCount = taskCounts?.total ?? 0;
  const completedTaskCount = taskCounts?.completed ?? 0;

  return {
    totalTaskCount,
    completedTaskCount,
    progressPercentage:
      totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100),
  };
}

function toProjectDetail(project: BackendProjectDetail): ProjectDetail {
  return {
    project: toProjectListItem(project),
    previewData: {
      ownerId: project.owner.id,
      ownerName: project.owner.name,
      startDate: project.startDate,
      targetDate: project.endDate,
    },
  };
}

export async function fetchProjects(
  workspaceId: string,
  status?: ProjectStatus,
): Promise<ProjectListItem[]> {
  const response = await apiClient.get<ApiSuccess<BackendProject[]>>(
    `/workspaces/${workspaceId}/projects`,
    { params: status ? { status } : undefined },
  );

  return response.data.data.map(toProjectListItem);
}

export async function fetchProject(projectId: string): Promise<ProjectDetail> {
  const response = await apiClient.get<ApiSuccess<BackendProjectDetail>>(
    `/projects/${projectId}`,
  );

  return toProjectDetail(response.data.data);
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ProjectListItem> {
  const response = await apiClient.post<ApiSuccess<BackendProject>>(
    `/workspaces/${workspaceId}/projects`,
    input,
  );

  return toProjectListItem(response.data.data);
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectListItem> {
  const response = await apiClient.patch<ApiSuccess<BackendProject>>(
    `/projects/${projectId}`,
    input,
  );

  return toProjectListItem(response.data.data);
}

export async function archiveProject(projectId: string): Promise<ProjectListItem> {
  const response = await apiClient.post<ApiSuccess<BackendProject>>(
    `/projects/${projectId}/archive`,
  );

  return toProjectListItem(response.data.data);
}

export async function restoreProject(projectId: string): Promise<ProjectListItem> {
  const response = await apiClient.post<ApiSuccess<BackendProject>>(
    `/projects/${projectId}/restore`,
  );

  return toProjectListItem(response.data.data);
}

// newOwnerId is a User id, not a WorkspaceMember id - intentionally
// different from the workspace-level transfer endpoint, which takes a
// WorkspaceMember id. See transferProjectOwnership in the backend's
// project.service.ts.
export async function transferProjectOwnership(
  projectId: string,
  newOwnerId: string,
): Promise<ProjectListItem> {
  const response = await apiClient.post<ApiSuccess<BackendProject>>(
    `/projects/${projectId}/transfer-ownership`,
    { newOwnerId },
  );

  return toProjectListItem(response.data.data);
}
