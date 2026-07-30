import { AtSign, CheckCircle2, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";

import type { NotificationType } from "../types";

// Frontend-chosen icon per backend `NotificationType`. Consumers should fall
// back to a neutral icon (e.g. Bell) for any type missing from this map, so a
// new backend enum value never breaks the popover.
export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  INVITATION_RECEIVED: UserPlus,
  TASK_ASSIGNED: CheckCircle2,
  COMMENT_ON_ASSIGNED_TASK: MessageSquare,
  COMMENT_MENTIONED: AtSign,
};
