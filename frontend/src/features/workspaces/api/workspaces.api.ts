import { apiClient, type ApiSuccess } from "@/lib/api";

import type { Workspace, WorkspaceMember } from "../types";

interface BackendWorkspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
}

interface BackendWorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

function toWorkspace(workspace: BackendWorkspace): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: workspace.role,
    createdAt: workspace.createdAt,
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
