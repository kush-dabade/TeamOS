import { Button } from "@/components/ui";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";

import type { TaskListItem } from "../../types";

interface TaskHeaderProps {
  taskItem: TaskListItem;
  onEdit: (trigger: HTMLButtonElement) => void;
  onDelete: () => void;
}

export function TaskHeader({ taskItem, onEdit, onDelete }: TaskHeaderProps) {
  const { task } = taskItem;

  return (
    <header className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{task.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={(event) => onEdit(event.currentTarget)}>
          Edit Task
        </Button>
        <Button type="button" variant="destructive" onClick={onDelete}>Delete Task</Button>
      </div>
    </header>
  );
}
