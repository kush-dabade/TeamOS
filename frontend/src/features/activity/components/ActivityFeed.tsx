import { Activity as ActivityIcon } from "lucide-react";

import { Button, Skeleton } from "@/components/ui";
import { EmptyState, ListErrorState } from "@/components/ux";
import { cn } from "@/utils";

import { ActivityItem } from "./ActivityItem";
import type { Activity } from "../types";

interface ActivityFeedProps {
  activities: Activity[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

// Shared state-branching (error/loading/empty/populated) for any feed of
// Activity entries. Callers own their own layout chrome (card vs. bare
// section, max-height/scroll) - this only renders what goes inside it.
export function ActivityFeed({
  activities,
  isLoading,
  isError,
  onRetry,
  emptyTitle,
  emptyDescription,
  className,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: ActivityFeedProps) {
  if (isError) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <ListErrorState
          title="Couldn't load activity"
          description="Something went wrong while loading this section."
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-0.5", className)}>
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-start gap-3 px-2 py-2.5">
            <Skeleton className="size-6 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <EmptyState icon={ActivityIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
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
