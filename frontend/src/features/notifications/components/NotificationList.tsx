import { Bell } from "lucide-react";

import { Button, Skeleton } from "@/components/ui";
import { EmptyState, ListErrorState } from "@/components/ux";

import { NotificationItem } from "./NotificationItem";
import type { Notification } from "../types";

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onMarkRead: (notificationId: string) => void;
  onNavigate: (destination: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
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
  onNavigate,
  hasMore,
  isLoadingMore,
  onLoadMore,
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
      <div className="space-y-0.5 px-2 py-1">
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-start gap-3 px-2 py-2.5">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
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
      <div className="flex min-h-48 items-center justify-center">
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You're all caught up."
          iconClassName="size-12"
        />
      </div>
    );
  }

  return (
    <div className="max-h-96 space-y-0.5 overflow-y-auto p-2">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={() => onMarkRead(notification.id)}
          onNavigate={onNavigate}
        />
      ))}

      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onLoadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? "Loading..." : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
