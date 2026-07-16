export type ProjectStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
