import { cn } from "@/utils";

import type { TaskStatus } from "../types";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const statusStyles: Record<TaskStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const statusLabels: Record<TaskStatus, string> = {
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        statusStyles[status],
        className,
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
