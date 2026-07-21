import { apiClient, type ApiSuccess } from "@/lib/api";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await apiClient.get<ApiSuccess<Workspace[]>>("/workspaces");

  return response.data.data;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const response = await apiClient.get<ApiSuccess<WorkspaceMember[]>>(
    `/workspaces/${workspaceId}/members`,
  );

  return response.data.data;
}
