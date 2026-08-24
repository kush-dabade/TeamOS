import type { TaskPriority, TaskStatus } from "@/features/tasks";
import type { SprintStatus } from "@/features/sprints";
import type { WorkspaceRole } from "@/features/workspaces";

export interface SearchProject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface SearchTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
}

export interface SearchSprint {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  projectId: string;
}

export interface SearchMember {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: WorkspaceRole;
}

export interface SearchResults {
  query: string;
  projects: SearchProject[];
  tasks: SearchTask[];
  sprints: SearchSprint[];
  members: SearchMember[];
}
