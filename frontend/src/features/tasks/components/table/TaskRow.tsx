import { formatDate, formatRelativeDate, getInitials } from "@/utils";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";

import type { TaskListItem } from "../../types";

interface TaskRowProps {
  taskItem: TaskListItem;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
}

export function TaskRow({ taskItem, isSelected, onSelect }: TaskRowProps) {
  const { assignee, project, task } = taskItem;
  const selectTask = () => onSelect(task.id);

  return (
    <tr
      aria-label={`Select task ${task.title}`}
      aria-selected={isSelected}
      tabIndex={0}
      onClick={selectTask}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectTask();
        }
      }}
      className="cursor-pointer border-b transition-colors outline-hidden hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-selected:bg-muted/70"
    >
      <th scope="row" className="max-w-0 px-3 py-1.5 text-left font-medium">
        <div className="min-w-0">
          <p className="break-words leading-5">{task.title}</p>
          {task.description ? (
            <p className="truncate text-xs leading-4 text-muted-foreground">{task.description}</p>
          ) : null}
        </div>
      </th>
      <td className="px-3 py-1.5">
        <TaskStatusBadge status={task.status} />
      </td>
      <td className="px-3 py-1.5">
        <TaskPriorityBadge priority={task.priority} />
      </td>
      <td className="px-3 py-1.5">
        {assignee ? (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground"
            >
              {getInitials(assignee.name)}
            </span>
            <span className="text-sm">{assignee.name}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </td>
      <td className="max-w-40 truncate px-3 py-1.5 text-sm text-muted-foreground">
        {project.name}
      </td>
      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {task.dueDate ? formatDate(task.dueDate, "MMM d, yyyy") : "—"}
      </td>
      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {formatRelativeDate(task.updatedAt)}
      </td>
    </tr>
  );
}
