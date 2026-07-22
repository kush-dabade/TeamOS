export type ProjectStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type ProjectStatusFilter = "ALL" | ProjectStatus;

export type ProjectSortOption = "RECENTLY_UPDATED" | "NAME_ASC" | "NAME_DESC";

export type ProjectWorkspaceTab = "tasks" | "sprints" | "activity";

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
  progressPercentage: number;
}

export interface ProjectPreviewData {
  ownerName: string;
  startDate: string | null;
  targetDate: string | null;
}

export interface ProjectDetail {
  project: ProjectListItem;
  previewData: ProjectPreviewData;
}
