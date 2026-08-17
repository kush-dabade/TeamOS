import { useMemo } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { ActivityFeed, useTaskActivity } from "@/features/activity";

interface TaskActivityProps {
  workspaceId: string;
  taskId: string;
}

export function TaskActivity({ workspaceId, taskId }: TaskActivityProps) {
  const activityQuery = useTaskActivity(workspaceId, taskId);

  // ActivityFeed stays pagination-unaware - flattening happens here, at the
  // hook/container boundary, mirroring NotificationsPopover for Notifications.
  const activities = useMemo(
    () => activityQuery.data?.pages.flatMap((page) => page.activities) ?? [],
    [activityQuery.data],
  );

  return (
    <Card size="sm">
      <CardHeader>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          Activity
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {activities.length}
          </span>
        </h3>
      </CardHeader>
      <CardContent className="flex-1 min-h-64 max-h-96">
        <ActivityFeed
          activities={activities}
          isLoading={activityQuery.isLoading}
          isError={activityQuery.isError}
          onRetry={() => activityQuery.refetch()}
          emptyTitle="No activity yet"
          emptyDescription="Updates to this task will appear here."
          className="h-full overflow-y-auto pr-1"
          hasMore={activityQuery.hasNextPage}
          isLoadingMore={activityQuery.isFetchingNextPage}
          onLoadMore={() => activityQuery.fetchNextPage()}
        />
      </CardContent>
    </Card>
  );
}
