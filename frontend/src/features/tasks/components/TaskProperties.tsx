import { formatDate, formatRelativeDate } from "@/utils";

import type { TaskAssignee, TaskListItem } from "../types";

interface TaskPropertiesProps {
  taskItem: TaskListItem;
  createdBy: TaskAssignee | null;
}

export function TaskProperties({ taskItem, createdBy }: TaskPropertiesProps) {
  const { assignee, project, task } = taskItem;

  return (
    <dl className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Project</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">{project.name}</dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Sprint</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">
          {task.sprintId ? task.sprintId : "Not assigned to a sprint"}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Assignee</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">
          {assignee?.name ?? "Unassigned"}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Due date</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">
          {task.dueDate ? formatDate(task.dueDate, "MMM d, yyyy") : "No due date"}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Created by</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">
          {createdBy?.name ?? "Unknown user"}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Created at</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">
          {formatDate(task.createdAt, "MMM d, yyyy 'at' h:mm a")}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Updated at</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">
          {formatRelativeDate(task.updatedAt)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Completed at</dt>
        <dd className="min-w-0 break-words text-right text-sm font-medium">
          {task.completedAt
            ? formatDate(task.completedAt, "MMM d, yyyy 'at' h:mm a")
            : "Not completed"}
        </dd>
      </div>
    </dl>
  );
}
