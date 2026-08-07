export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export interface Sprint {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}
