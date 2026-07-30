import { useState } from "react";
import { BellIcon } from "lucide-react";

import {
  Button,
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui";

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

      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>

        <NotificationList
          notifications={notificationsQuery.data ?? []}
          isLoading={notificationsQuery.isLoading}
          isError={notificationsQuery.isError}
          onRetry={() => notificationsQuery.refetch()}
          onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
        />
      </PopoverContent>
    </Popover>
  );
}
