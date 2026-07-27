import { cn } from "@/utils";

import { ROLE_LABELS } from "../lib/workspace-roles";
import type { WorkspaceRole } from "../types";

interface WorkspaceRoleBadgeProps {
  role: WorkspaceRole;
  className?: string;
}

const roleStyles: Record<WorkspaceRole, string> = {
  OWNER: "bg-primary/10 text-primary",
  ADMIN: "bg-info/10 text-info",
  MEMBER: "bg-muted text-muted-foreground",
  GUEST: "bg-secondary text-secondary-foreground",
};

export function WorkspaceRoleBadge({ role, className }: WorkspaceRoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        roleStyles[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
