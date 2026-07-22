export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}
