import { useRef } from "react";

import { UserAvatar } from "@/components/ux";
import { env } from "@/lib/env";
import { formatDate, formatRelativeDate } from "@/utils";

import { TaskPriorityBadge } from "../TaskPriorityBadge";
import { TaskStatusBadge } from "../TaskStatusBadge";

import type { TaskAssignee, TaskListItem } from "../../types";

interface TaskRowProps {
  taskItem: TaskListItem;
  isSelected: boolean;
  showProjectColumn?: boolean;
  onSelect: (taskId: string, trigger: HTMLButtonElement | null) => void;
}

// Builds the URL for an assignee's avatar (Commit 1's
// GET /users/:id/avatar). Deliberately not routed through the shared
// getAvatarUrl() util - see workspace-member-row.tsx's identical helper for
// why (hardcoded to /users/me/avatar, requires `updatedAt` this data
// doesn't carry). Generalizing that helper is P4-AVATAR-RENDER's job
// (Commit 4), which should also fold this and workspace-member-row's copy
// into one.
function getAssigneeAvatarUrl(assignee: TaskAssignee): string | null {
  if (!assignee.image) {
    return null;
  }

  return `${env.apiUrl}/api/v1/users/${assignee.id}/avatar`;
}

export function TaskRow({ taskItem, isSelected, showProjectColumn = true, onSelect }: TaskRowProps) {
  const { assignee, project, task } = taskItem;
  const taskTitleButtonRef = useRef<HTMLButtonElement>(null);
  const selectTask = () => onSelect(task.id, taskTitleButtonRef.current);

  return (
    <tr
      aria-selected={isSelected}
      onClick={selectTask}
      className="cursor-pointer border-b transition-colors even:bg-muted/20 hover:bg-muted/50 aria-selected:bg-muted/70"
    >
      <th scope="row" className="max-w-0 px-3 py-1.5 text-left font-medium">
        <button
          ref={taskTitleButtonRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            selectTask();
          }}
          className="block w-full rounded-sm text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block break-words leading-5">{task.title}</span>
          {task.description ? (
            <span className="block truncate text-xs leading-4 text-muted-foreground">
              {task.description}
            </span>
          ) : null}
        </button>
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
            <UserAvatar
              name={assignee.name}
              image={getAssigneeAvatarUrl(assignee)}
              size="sm"
              shape="square"
            />
            <span className="text-sm">{assignee.name}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </td>
      {showProjectColumn ? (
        <td className="max-w-40 truncate px-3 py-1.5 text-sm text-muted-foreground">
          {project.name}
        </td>
      ) : null}
      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {task.dueDate ? formatDate(task.dueDate, "MMM d, yyyy") : "—"}
      </td>
      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {formatRelativeDate(task.updatedAt)}
      </td>
    </tr>
  );
}
