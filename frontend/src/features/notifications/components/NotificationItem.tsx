import { Bell } from "lucide-react";

import { cn, formatRelativeDate } from "@/utils";

import { getNotificationDestination } from "../lib/notification-destination";
import { NOTIFICATION_ICONS } from "../lib/notification-icon";
import type { Notification } from "../types";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: () => void;
  onNavigate: (destination: string) => void;
}

// Presentational building block for a single notification. Clicking an
// unread notification marks it read and, for types with a resolvable
// destination (see getNotificationDestination), navigates there; read
// notifications are inert (no destructive/edit affordances exist for
// notifications, unlike comments).
//
// Navigating is delegated to onNavigate rather than calling useNavigate()
// here directly - NotificationsPopover owns the popover's open state, so
// it's the one that closes the popover before navigating, the same way
// SearchCommand (not SearchResultItem) is what closes the command palette
// before navigating on select. This component only decides whether/where to
// go; it doesn't know the popover exists.
//
// The unread signal is deliberately singular - a small dot next to the
// title - rather than stacking a dot + tinted background + tinted icon like
// the previous design did. The icon container stays neutral for every row;
// it's a type indicator (comment/mention/assignment/invite), not a user
// avatar - the Notification contract has no actor field to render one from.
export function NotificationItem({ notification, onMarkRead, onNavigate }: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;

  const destination = getNotificationDestination(notification);
  // Only a read row with nowhere to go is truly inert now - an unread row
  // always has mark-read to do, and a read row with a destination still has
  // navigation to do.
  const isInert = notification.isRead && !destination;

  // Unread rows still mark read then navigate, exactly as before (onMarkRead
  // fires the existing mutation - mutate, not mutateAsync - so its failure,
  // handled entirely by the mutation's own onError toast, can never block or
  // skip navigation). Already-read rows must never re-trigger that mutation -
  // there's nothing left to mark - so they only navigate.
  function handleClick() {
    if (notification.isRead) {
      if (destination) {
        onNavigate(destination);
      }
      return;
    }

    onMarkRead();
    if (destination) {
      onNavigate(destination);
    }
  }

  return (
    <button
      type="button"
      disabled={isInert}
      onClick={isInert ? undefined : handleClick}
      aria-label={notification.isRead ? undefined : `Mark "${notification.title}" as read`}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-150 hover:bg-muted/40",
        !notification.isRead && "cursor-pointer",
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm leading-5 font-medium">{notification.title}</p>

          {!notification.isRead ? (
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>

        <time className="mt-1 block text-xs text-muted-foreground/60">
          {formatRelativeDate(notification.createdAt)}
        </time>
      </div>
    </button>
  );
}
