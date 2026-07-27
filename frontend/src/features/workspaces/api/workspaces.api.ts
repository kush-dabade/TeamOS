import { apiClient, type ApiSuccess } from "@/lib/api";

import type { Workspace, WorkspaceMember, WorkspaceRole } from "../types";

interface BackendWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt?: string;
}

interface BackendWorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

function toWorkspace(workspace: BackendWorkspace): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: workspace.role,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function toWorkspaceMember(member: BackendWorkspaceMember): WorkspaceMember {
  return {
    id: member.id,
    userId: member.userId,
    name: member.name,
    email: member.email,
    role: member.role,
    joinedAt: member.joinedAt,
  };
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await apiClient.get<ApiSuccess<BackendWorkspace[]>>("/workspaces");

  return response.data.data.map(toWorkspace);
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const response = await apiClient.get<ApiSuccess<BackendWorkspaceMember[]>>(
    `/workspaces/${workspaceId}/members`,
  );

  return response.data.data.map(toWorkspaceMember);
}

export interface CreateWorkspaceInput {
  name: string;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<void> {
  await apiClient.post("/workspaces", input);
}

export async function fetchWorkspace(workspaceId: string): Promise<Workspace> {
  const response = await apiClient.get<ApiSuccess<BackendWorkspace>>(
    `/workspaces/${workspaceId}`,
  );

  return toWorkspace(response.data.data);
}

export interface UpdateWorkspaceInput {
  name: string;
}

export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<Workspace> {
  const response = await apiClient.patch<ApiSuccess<BackendWorkspace>>(
    `/workspaces/${workspaceId}`,
    input,
  );

  return toWorkspace(response.data.data);
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<WorkspaceMember> {
  const response = await apiClient.patch<ApiSuccess<BackendWorkspaceMember>>(
    `/workspaces/${workspaceId}/members/${memberId}`,
    { role },
  );

  return toWorkspaceMember(response.data.data);
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string): Promise<void> {
  await apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`);
}
