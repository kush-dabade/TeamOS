import { cn } from "@/utils";

import type { TaskPriority } from "../types";

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

const priorityStyles: Record<TaskPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-info/10 text-info",
  HIGH: "bg-warning/10 text-warning",
  URGENT: "bg-destructive/10 text-destructive",
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        priorityStyles[priority],
        className,
      )}
    >
      {priorityLabels[priority]}
    </span>
  );
}
