import { SprintStatus, TaskPriority, TaskStatus, WorkspaceRole } from "../../generated/prisma/enums.js";

export interface SearchProjectResult {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface SearchTaskResult {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
}

export interface SearchSprintResult {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  projectId: string;
}

export interface SearchMemberResult {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: WorkspaceRole;
}

export interface SearchResponse {
  query: string;
  projects: SearchProjectResult[];
  tasks: SearchTaskResult[];
  sprints: SearchSprintResult[];
  members: SearchMemberResult[];
}