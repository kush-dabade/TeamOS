import { useRef } from "react";
import { startOfToday } from "date-fns";

import { TaskPriorityBadge } from "@/features/tasks/components/TaskPriorityBadge";
import { TaskStatusBadge } from "@/features/tasks/components/TaskStatusBadge";
import type { TaskListItem } from "@/features/tasks/types";
import { cn, formatDate } from "@/utils";

interface MyTaskRowProps {
  taskItem: TaskListItem;
  onSelect: (taskId: string) => void;
}

export function MyTaskRow({ taskItem, onSelect }: MyTaskRowProps) {
  const { project, task } = taskItem;
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const selectTask = () => onSelect(task.id);

  const isOverdue =
    task.dueDate !== null && task.status !== "DONE" && new Date(task.dueDate) < startOfToday();

  return (
    <tr
      onClick={selectTask}
      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <th scope="row" className="max-w-0 px-3 py-1.5 text-left font-medium">
        <button
          ref={titleButtonRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            selectTask();
          }}
          className="block w-full truncate rounded-sm text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {task.title}
        </button>
      </th>
      <td className="max-w-40 truncate px-3 py-1.5 text-sm text-muted-foreground">
        {project.name}
      </td>
      <td
        className={cn(
          "px-3 py-1.5 text-sm whitespace-nowrap",
          isOverdue ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {task.dueDate ? formatDate(task.dueDate) : "—"}
      </td>
      <td className="px-3 py-1.5">
        <TaskPriorityBadge priority={task.priority} />
      </td>
      <td className="px-3 py-1.5">
        <TaskStatusBadge status={task.status} />
      </td>
    </tr>
  );
}
