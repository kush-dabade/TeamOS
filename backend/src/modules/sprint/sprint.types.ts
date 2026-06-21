export interface CreateSprintData {
  projectId: string;

  name: string;
  goal?: string | undefined;

  startDate?: Date | undefined;
  endDate?: Date | undefined;
}