import { apiClient, type ApiSuccess } from "@/lib/api";

import type { Task, TaskPriority, TaskStatus } from "../types";

interface BackendTask {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdById: string;
  assigneeId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

// The backend task resource never returns deletedAt (soft-deleted tasks are
// simply excluded from list/detail results) or sprintId (not exposed by any
// endpoint yet - populated once Sprints integration lands).
function toTask(task: BackendTask): Task {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    createdById: task.createdById,
    assigneeId: task.assigneeId,
    completedAt: task.completedAt,
    deletedAt: null,
    sprintId: null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const response = await apiClient.get<ApiSuccess<BackendTask[]>>(
    `/projects/${projectId}/tasks`,
  );

  return response.data.data.map(toTask);
}

export async function fetchTask(taskId: string): Promise<Task> {
  const response = await apiClient.get<ApiSuccess<BackendTask>>(`/tasks/${taskId}`);

  return toTask(response.data.data);
}

export async function createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
  const response = await apiClient.post<ApiSuccess<BackendTask>>(
    `/projects/${projectId}/tasks`,
    input,
  );

  return toTask(response.data.data);
}

export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
  const response = await apiClient.patch<ApiSuccess<BackendTask>>(`/tasks/${taskId}`, input);

  return toTask(response.data.data);
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiClient.delete<ApiSuccess<null>>(`/tasks/${taskId}`);
}
