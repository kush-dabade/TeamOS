import { useMemo } from "react";

import { ActivityFeed, useProjectActivity } from "@/features/activity";

interface ProjectActivityProps {
  workspaceId: string;
  projectId: string;
}

export function ProjectActivity({ workspaceId, projectId }: ProjectActivityProps) {
  const activityQuery = useProjectActivity(workspaceId, projectId);

  // ActivityFeed stays pagination-unaware - flattening happens here, at the
  // hook/container boundary, mirroring NotificationsPopover for Notifications.
  const activities = useMemo(
    () => activityQuery.data?.pages.flatMap((page) => page.activities) ?? [],
    [activityQuery.data],
  );

  return (
    <ActivityFeed
      activities={activities}
      isLoading={activityQuery.isLoading}
      isError={activityQuery.isError}
      onRetry={() => activityQuery.refetch()}
      emptyTitle="No activity yet"
      emptyDescription="Updates to this project will appear here."
      hasMore={activityQuery.hasNextPage}
      isLoadingMore={activityQuery.isFetchingNextPage}
      onLoadMore={() => activityQuery.fetchNextPage()}
    />
  );
}
