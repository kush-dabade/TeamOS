import { Button } from "@/components/ui";
import { formatDate } from "@/utils";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";

import type { TaskListItem } from "../../types";

interface TaskHeaderProps {
  taskItem: TaskListItem;
  onEdit: (trigger: HTMLButtonElement) => void;
  onDelete: () => void;
}

export function TaskHeader({ taskItem, onEdit, onDelete }: TaskHeaderProps) {
  const { assignee, project, task } = taskItem;

  return (
    <header className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-semibold tracking-tight">{task.title}</h1>

        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
          {task.description ?? "No description provided."}
        </p>

        <div className="mt-3 overflow-x-auto">
          <div className="flex w-max items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <span aria-hidden="true">•</span>
            <span>{assignee?.name ?? "Unassigned"}</span>
            <span aria-hidden="true">•</span>
            <span>{project.name}</span>
            <span aria-hidden="true">•</span>
            <span>{task.sprintId ?? "No sprint"}</span>
            <span aria-hidden="true">•</span>
            <span>{task.dueDate ? formatDate(task.dueDate, "MMM d") : "No due date"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={(event) => onEdit(event.currentTarget)}>
          Edit Task
        </Button>
        <Button type="button" variant="destructive" onClick={onDelete}>Delete Task</Button>
      </div>
    </header>
  );
}
