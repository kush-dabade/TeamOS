import { cn } from "@/utils";
import type { InvitationStatus } from "@/features/workspaces/types";

interface InvitationStatusBadgeProps {
  status: InvitationStatus;
  className?: string;
}

const statusStyles: Record<InvitationStatus, string> = {
  PENDING: "bg-warning/10 text-warning",
  ACCEPTED: "bg-success/10 text-success",
  DECLINED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<InvitationStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

export function InvitationStatusBadge({ status, className }: InvitationStatusBadgeProps) {
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
