import { Bell } from "lucide-react";

import { cn, formatRelativeDate } from "@/utils";

import { NOTIFICATION_ICONS } from "../lib/notification-icon";
import type { Notification } from "../types";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: () => void;
}

// Presentational building block for a single notification. Clicking an
// unread notification marks it read; read notifications are inert (no
// destructive/edit affordances exist for notifications, unlike comments).
export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;

  return (
    <button
      type="button"
      disabled={notification.isRead}
      onClick={notification.isRead ? undefined : onMarkRead}
      aria-label={notification.isRead ? undefined : `Mark "${notification.title}" as read`}
      className={cn(
        "flex w-full items-start gap-3 rounded-md p-1.5 text-left transition-colors",
        !notification.isRead && "cursor-pointer bg-primary/5 hover:bg-primary/10",
      )}
    >
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
          !notification.isRead && "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-5", !notification.isRead && "font-medium")}>
            {notification.title}
          </p>

          {!notification.isRead ? (
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>

        <time className="mt-1 block text-xs text-muted-foreground">
          {formatRelativeDate(notification.createdAt)}
        </time>
      </div>
    </button>
  );
}
