import { cn } from "@/utils";

import type { SprintStatus } from "../types";

interface SprintStatusBadgeProps {
  status: SprintStatus;
  className?: string;
}

const statusStyles: Record<SprintStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-info/10 text-info",
  COMPLETED: "bg-success/10 text-success",
};

const statusLabels: Record<SprintStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

export function SprintStatusBadge({ status, className }: SprintStatusBadgeProps) {
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
