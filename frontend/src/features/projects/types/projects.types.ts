export type ProjectStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type ProjectStatusFilter = "ALL" | ProjectStatus;

export type ProjectSortOption = "RECENTLY_UPDATED" | "NAME_ASC" | "NAME_DESC";

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListItem {
  project: Project;
  completedTaskCount: number;
  totalTaskCount: number;
}
