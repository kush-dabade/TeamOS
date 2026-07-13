import type { DashboardTask } from "../types";

import { TaskPriorityBadge } from "./task-priority-badge";

interface TaskRowProps {
  task: DashboardTask;
  onClick?: () => void;
}

export function TaskRow({ task, onClick }: TaskRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group flex w-full items-center justify-between rounded-lg
        px-3 py-2.5
        text-left
        transition-all duration-150
        hover:bg-muted/70
        focus-visible:ring-ring focus-visible:ring-2
        focus-visible:outline-none
      "
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium transition-colors group-hover:text-foreground">
          {task.title}
        </h3>

        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <span className="truncate">{task.projectName}</span>

          {task.dueDate ? (
            <>
              <span>•</span>
              <span>{task.dueDate}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="ml-4 shrink-0">
        <TaskPriorityBadge priority={task.priority} />
      </div>
    </button>
  );
}
