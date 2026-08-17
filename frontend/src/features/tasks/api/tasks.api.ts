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
  sprintId: string | null;
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

export interface TaskPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// The task list endpoint's envelope nests results under `data.tasks` with a
// sibling `pagination` block, unlike the flat `ApiSuccess<T>` envelope other
// task endpoints use - mirrors the Activity list endpoint's own local
// response shape for the same reason.
interface TaskListResponse {
  success: true;
  data: {
    tasks: BackendTask[];
  };
  pagination: TaskPagination;
}

export interface ListProjectTasksParams {
  page?: number;
  limit?: number;
}

export interface ListProjectTasksResult {
  tasks: Task[];
  pagination: TaskPagination;
}

// The backend task resource never returns deletedAt (soft-deleted tasks are
// simply excluded from list/detail results).
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
    sprintId: task.sprintId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function fetchProjectTasks(
  projectId: string,
  params: ListProjectTasksParams = {},
): Promise<ListProjectTasksResult> {
  const response = await apiClient.get<TaskListResponse>(`/projects/${projectId}/tasks`, {
    params,
  });

  return {
    tasks: response.data.data.tasks.map(toTask),
    pagination: response.data.pagination,
  };
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
