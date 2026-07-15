import type { DashboardTask } from "../types";

import { ChevronRight } from "lucide-react";

import { TaskPriorityBadge } from "./task-priority-badge";

interface FocusItemProps {
  task: DashboardTask;
  onClick?: () => void;
}

export function FocusItem({ task, onClick }: FocusItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group w-full
        rounded-md
        px-3 py-2.5
        text-left
        transition-colors duration-150
        hover:bg-muted/50
        focus-visible:ring-ring focus-visible:ring-2
        focus-visible:outline-hidden
      "
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-sm font-medium leading-none">{task.title}</h3>

            <TaskPriorityBadge priority={task.priority} />
          </div>

          <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{task.projectName}</span>

              {task.dueDate ? (
                <>
                  <span>•</span>
                  <span className="shrink-0">{task.dueDate}</span>
                </>
              ) : null}
            </div>

            <ChevronRight
              className="
                h-3.5
                w-3.5
                shrink-0
                opacity-0
                transition-all duration-150
                group-hover:translate-x-0.5
                group-hover:opacity-100
              "
            />
          </div>
        </div>
      </div>
    </button>
  );
}
