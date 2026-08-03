import type { TaskPriority, TaskStatus } from "@/features/tasks";

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

export interface SearchResults {
  query: string;
  projects: SearchProject[];
  tasks: SearchTask[];
}
