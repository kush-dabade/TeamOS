import { Button, Card, CardContent, CardFooter, CardHeader, Separator } from "@/components/ui";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";
import { TaskOverview } from "../TaskOverview";
import { TaskProperties } from "../TaskProperties";

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
      <Card aria-busy="true" aria-label="Loading task preview">
        <CardContent className="pt-6">
          <TaskPreviewPanelSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!taskItem) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center pt-6 text-center">
          <p role="status" className="text-sm text-muted-foreground">
            Select a task to view its details.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { task } = taskItem;

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
          <h3 id="task-overview-heading" className="text-sm font-medium">
            Overview
          </h3>
          <div className="mt-2">
            <TaskOverview task={task} />
          </div>
        </section>

        <Separator />

        <section aria-labelledby="task-properties-heading">
          <h3 id="task-properties-heading" className="text-sm font-medium">
            Properties
          </h3>
          <div className="mt-3">
            <TaskProperties taskItem={taskItem} createdBy={createdBy} />
          </div>
        </section>
      </CardContent>

      <CardFooter className="justify-end">
        <Button type="button" onClick={() => onOpenTask(task.id)}>
          Open Task
        </Button>
      </CardFooter>
    </Card>
  );
}
