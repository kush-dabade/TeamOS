import { Bell } from "lucide-react";

import { Skeleton } from "@/components/ui";
import { EmptyState, ListErrorState } from "@/components/ux";

import { NotificationItem } from "./NotificationItem";
import type { Notification } from "../types";

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onMarkRead: (notificationId: string) => void;
}

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

// State-branching (error/loading/empty/populated) for the notifications
// list, mirroring the Activity feature's ActivityFeed. Kept as its own
// component (rather than reusing ActivityFeed) since notification rows need
// click-to-mark-read behavior that activity rows don't have.
export function NotificationList({
  notifications,
  isLoading,
  isError,
  onRetry,
  onMarkRead,
}: NotificationListProps) {
  if (isError) {
    return (
      <ListErrorState
        title="Couldn't load notifications"
        description="Something went wrong while loading notifications."
        onRetry={onRetry}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-start gap-3 p-1.5">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="Notifications will appear here."
      />
    );
  }

  return (
    <div className="max-h-96 space-y-1 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={() => onMarkRead(notification.id)}
        />
      ))}
    </div>
  );
}
