import { cn } from "@/utils";

import type { ProjectStatus } from "../types";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const statusStyles: Record<ProjectStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ARCHIVED: "bg-secondary text-secondary-foreground",
};

const statusLabels: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
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
