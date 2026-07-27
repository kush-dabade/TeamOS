export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}
