import { apiClient, type ApiSuccess } from "@/lib/api";
import type { Task } from "@/features/tasks";

import type { Sprint, SprintStatus } from "../types";

interface BackendSprint {
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

export interface CreateSprintInput {
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string | null;
  startDate?: string;
  endDate?: string;
}

function toSprint(sprint: BackendSprint): Sprint {
  return {
    id: sprint.id,
    workspaceId: sprint.workspaceId,
    projectId: sprint.projectId,
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
  };
}

export async function fetchProjectSprints(projectId: string): Promise<Sprint[]> {
  const response = await apiClient.get<ApiSuccess<BackendSprint[]>>(
    `/projects/${projectId}/sprints`,
  );

  return response.data.data.map(toSprint);
}

export async function fetchSprint(sprintId: string): Promise<Sprint> {
  const response = await apiClient.get<ApiSuccess<BackendSprint>>(`/sprints/${sprintId}`);

  return toSprint(response.data.data);
}

export async function createSprint(
  projectId: string,
  input: CreateSprintInput,
): Promise<Sprint> {
  const response = await apiClient.post<ApiSuccess<BackendSprint>>(
    `/projects/${projectId}/sprints`,
    input,
  );

  return toSprint(response.data.data);
}

export async function updateSprint(sprintId: string, input: UpdateSprintInput): Promise<Sprint> {
  const response = await apiClient.patch<ApiSuccess<BackendSprint>>(
    `/sprints/${sprintId}`,
    input,
  );

  return toSprint(response.data.data);
}

export async function startSprint(sprintId: string): Promise<Sprint> {
  const response = await apiClient.post<ApiSuccess<BackendSprint>>(`/sprints/${sprintId}/start`);

  return toSprint(response.data.data);
}

export async function completeSprint(sprintId: string): Promise<Sprint> {
  const response = await apiClient.post<ApiSuccess<BackendSprint>>(
    `/sprints/${sprintId}/complete`,
  );

  return toSprint(response.data.data);
}

// Unlike the Sprint endpoints above, these three endpoints already serialize
// through the backend's toTaskResponse mapper, so there is no separate
// Backend*/mapper pair: the wire shape matches the frontend Task type
// field-for-field (aside from deletedAt, which toTaskResponse omits and no
// consumer here reads).
export async function fetchSprintTasks(sprintId: string): Promise<Task[]> {
  const response = await apiClient.get<ApiSuccess<Task[]>>(`/sprints/${sprintId}/tasks`);

  return response.data.data;
}

export async function assignTaskToSprint(sprintId: string, taskId: string): Promise<Task> {
  const response = await apiClient.post<ApiSuccess<Task>>(
    `/sprints/${sprintId}/tasks/${taskId}`,
  );

  return response.data.data;
}

export async function removeTaskFromSprint(sprintId: string, taskId: string): Promise<Task> {
  const response = await apiClient.delete<ApiSuccess<Task>>(
    `/sprints/${sprintId}/tasks/${taskId}`,
  );

  return response.data.data;
}
