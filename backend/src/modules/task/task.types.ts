export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface CreateTaskData {
  projectId: string;

  assigneeId?: string | undefined;

  title: string;
  description?: string | undefined;

  priority?: TaskPriority | undefined;

  dueDate?: Date | undefined;
}

export interface ListTasksOptions {
  projectId: string;

  page: number;
  limit: number;
}

export interface UpdateTaskData {
  title?: string;

  description?: string | null;

  status?: TaskStatus;

  priority?: TaskPriority;

  assigneeId?: string | null;

  dueDate?: Date | null;
}
