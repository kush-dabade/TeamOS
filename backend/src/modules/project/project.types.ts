export type ProjectStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface CreateProjectData {
  workspaceId: string;
  ownerId: string;
  name: string;
  description?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

export interface ListProjectsOptions {
  workspaceId: string;
  status?: ProjectStatus | undefined;
}
