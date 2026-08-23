export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskStatusFilter = "ALL" | TaskStatus;

export type TaskPriorityFilter = "ALL" | TaskPriority;

export interface Task {
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
  deletedAt: string | null;
  sprintId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  id: string;
  name: string;
  image: string | null;
}

export interface TaskProject {
  id: string;
  slug: string;
  name: string;
}

export interface TaskListItem {
  task: Task;
  assignee: TaskAssignee | null;
  project: TaskProject;
}
