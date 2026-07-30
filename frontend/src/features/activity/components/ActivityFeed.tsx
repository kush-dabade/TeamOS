import { Activity as ActivityIcon } from "lucide-react";

import { Button, Skeleton } from "@/components/ui";
import { EmptyState } from "@/components/ux";
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
}: ActivityFeedProps) {
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load activity</p>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading this section.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {skeletonRows.map((row) => (
          <div key={row} className="flex items-start gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return <EmptyState icon={ActivityIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
