import { useState } from "react";
import { ArrowRight, BellIcon } from "lucide-react";

import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

import { useMarkNotificationRead } from "../hooks/use-mark-notification-read";
import { useNotifications } from "../hooks/use-notifications";
import { useUnreadNotificationCount } from "../hooks/use-unread-notification-count";
import { NotificationList } from "./NotificationList";

// The only stateful notifications component - owns popover open state, the
// list/unread-count queries, and the mark-read mutation. Mirrors
// CommentsPanel's role in the comments feature: self-contained, since the
// header bell is its only consumer.
export function NotificationsPopover() {
  const [open, setOpen] = useState(false);

  const notificationsQuery = useNotifications(open);
  const unreadCountQuery = useUnreadNotificationCount();
  const markReadMutation = useMarkNotificationRead();

  const unreadCount = unreadCountQuery.data ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="relative"
        >
          <BellIcon className="size-4" />
          {unreadCount > 0 ? (
            <span
              className="absolute top-1 right-1 flex size-2 rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <h2 className="text-sm font-medium">Notifications</h2>
          {unreadCount > 0 ? (
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {unreadCount}
            </span>
          ) : null}
        </div>

        <div className="border-t border-border/50">
          <NotificationList
            notifications={notificationsQuery.data ?? []}
            isLoading={notificationsQuery.isLoading}
            isError={notificationsQuery.isError}
            onRetry={() => notificationsQuery.refetch()}
            onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
          />
        </div>

        <div className="border-t border-border/50 p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled
            className="w-full justify-center gap-1.5 text-muted-foreground"
          >
            View all notifications
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
