import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Separator,
} from "@/components/ui";
import { formatDate, formatRelativeDate } from "@/utils";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";

import { TaskPreviewPanelSkeleton } from "./TaskPreviewPanelSkeleton";

import type { TaskAssignee, TaskListItem } from "../../types";

interface TaskPreviewPanelProps {
  taskItem: TaskListItem | null;
  createdBy: TaskAssignee | null;
  isLoading: boolean;
  onOpenTask: (taskId: string) => void;
}

export function TaskPreviewPanel({
  taskItem,
  createdBy,
  isLoading,
  onOpenTask,
}: TaskPreviewPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <TaskPreviewPanelSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!taskItem) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">Select a task to view its details.</p>
        </CardContent>
      </Card>
    );
  }

  const { assignee, project, task } = taskItem;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base leading-snug font-medium">{task.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <section aria-labelledby="task-overview-heading">
          <h3 id="task-overview-heading" className="text-sm font-medium">Overview</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {task.description ?? "No description provided."}
          </p>
        </section>

        <Separator />

        <section aria-labelledby="task-properties-heading">
          <h3 id="task-properties-heading" className="text-sm font-medium">Properties</h3>
          <dl className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Project</dt>
              <dd className="text-right text-sm font-medium">{project.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Sprint</dt>
              <dd className="text-right text-sm font-medium">
                {task.sprintId ? task.sprintId : "Not assigned to a sprint"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Assignee</dt>
              <dd className="text-right text-sm font-medium">{assignee?.name ?? "Unassigned"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Due date</dt>
              <dd className="text-right text-sm font-medium">
                {task.dueDate ? formatDate(task.dueDate, "MMM d, yyyy") : "No due date"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Created by</dt>
              <dd className="text-right text-sm font-medium">{createdBy?.name ?? "Unknown user"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Created at</dt>
              <dd className="text-right text-sm font-medium">
                {formatDate(task.createdAt, "MMM d, yyyy 'at' h:mm a")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Updated at</dt>
              <dd className="text-right text-sm font-medium">{formatRelativeDate(task.updatedAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Completed at</dt>
              <dd className="text-right text-sm font-medium">
                {task.completedAt
                  ? formatDate(task.completedAt, "MMM d, yyyy 'at' h:mm a")
                  : "Not completed"}
              </dd>
            </div>
          </dl>
        </section>
      </CardContent>

      <CardFooter className="justify-end">
        <Button type="button" onClick={() => onOpenTask(task.id)}>Open Task</Button>
      </CardFooter>
    </Card>
  );
}
