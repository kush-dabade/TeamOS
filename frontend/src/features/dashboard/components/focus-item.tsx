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
        rounded-lg
        px-4 py-3
        text-left
        transition-colors
        hover:bg-muted/40
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3
            className="
              truncate
              text-sm
              font-medium
              transition-colors
              group-hover:text-foreground
            "
          >
            {task.title}
          </h3>

          <div
            className="
              text-muted-foreground
              mt-1.5
              flex
              flex-wrap
              items-center
              gap-x-2
              gap-y-1
              text-xs
            "
          >
            <span>{task.projectName}</span>

            {task.dueDate && (
              <>
                <span>•</span>
                <span>{task.dueDate}</span>
              </>
            )}

            {/* Future:
                • Waiting for review
                • In Progress
                • Sprint 12
                • Updated 2h ago
            */}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TaskPriorityBadge priority={task.priority} />

          <ChevronRight
            className="
              text-muted-foreground
              h-4
              w-4
              opacity-0
              transition-all
              duration-150
              group-hover:translate-x-0.5
              group-hover:opacity-100
            "
          />
        </div>
      </div>
    </button>
  );
}
