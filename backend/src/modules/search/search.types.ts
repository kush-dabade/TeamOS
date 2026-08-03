import { TaskPriority, TaskStatus } from "../../generated/prisma/enums.js";

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

export interface SearchResponse {
  query: string;
  projects: SearchProjectResult[];
  tasks: SearchTaskResult[];
}