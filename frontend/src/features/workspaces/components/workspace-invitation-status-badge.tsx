import { cn } from "@/utils";

interface WorkspaceInvitationStatusBadgeProps {
  className?: string;
}

export function WorkspaceInvitationStatusBadge({
  className,
}: WorkspaceInvitationStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning",
        className,
      )}
    >
      Pending
    </span>
  );
}
