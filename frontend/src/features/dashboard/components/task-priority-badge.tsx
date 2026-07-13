import type { DashboardTaskPriority } from "../types";

interface TaskPriorityBadgeProps {
  priority: DashboardTaskPriority;
}

const priorityStyles: Record<DashboardTaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-100 text-sky-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${priorityStyles[priority]}`}
    >
      {priority}
    </span>
  );
}
