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
