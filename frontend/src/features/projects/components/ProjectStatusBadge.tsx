import { cn } from "@/utils";

import type { ProjectStatus } from "../types";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const statusStyles: Record<ProjectStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-info/10 text-info",
  COMPLETED: "bg-success/10 text-success",
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
