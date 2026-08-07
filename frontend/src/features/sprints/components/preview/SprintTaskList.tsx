import { ListTodo } from "lucide-react";

import { Button, Skeleton } from "@/components/ui";
import { EmptyState, ListErrorState } from "@/components/ux";
import type { Task } from "@/features/tasks";

import { SprintTaskItem } from "./SprintTaskItem";

interface SprintTaskListProps {
  tasks: Task[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onAssignTask: () => void;
  isAssigningTask: boolean;
  removingTaskId: string | null;
  onRemove: (taskId: string) => void;
}

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

export function SprintTaskList({
  tasks,
  isLoading,
  isError,
  onRetry,
  onAssignTask,
  isAssigningTask,
  removingTaskId,
  onRemove,
}: SprintTaskListProps) {
  if (isError) {
    return (
      <ListErrorState
        title="Couldn't load tasks"
        description="Something went wrong while loading this sprint's tasks."
        onRetry={onRetry}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center">
        <EmptyState
          icon={ListTodo}
          title="No tasks in this sprint"
          description="Assign existing tasks from this project to plan this sprint's work."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={onAssignTask}
              disabled={isAssigningTask}
            >
              {isAssigningTask ? "Assigning..." : "Assign task"}
            </Button>
          }
          iconClassName="size-10"
        />
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {tasks.map((task) => (
        <SprintTaskItem
          key={task.id}
          task={task}
          isRemoving={removingTaskId === task.id}
          onRemove={() => onRemove(task.id)}
        />
      ))}
    </div>
  );
}
