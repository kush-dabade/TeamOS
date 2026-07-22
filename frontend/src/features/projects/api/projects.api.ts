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

// The backend project resource does not include task counts - there is no
// aggregate endpoint for them. This layer always reports 0/0/0%; real counts
// are computed client-side from Tasks data by `useProjectsWithTaskCounts` /
// `useProjectWithTaskCounts`, which overwrite these fields after this mapping
// runs. Kept here (rather than omitted) so `ProjectListItem` has one shape
// regardless of which hook produced it.
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
    completedTaskCount: 0,
    totalTaskCount: 0,
    progressPercentage: 0,
  };
}

function toProjectDetail(project: BackendProjectDetail): ProjectDetail {
  return {
    project: toProjectListItem(project),
    previewData: {
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
