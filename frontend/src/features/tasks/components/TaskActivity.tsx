import type { ReactNode } from "react";
import { Activity as ActivityIcon } from "lucide-react";

import { Button, Card, CardContent, CardHeader, Skeleton } from "@/components/ui";
import { EmptyState } from "@/components/ux";
import { ActivityItem, useTaskActivity } from "@/features/activity";

interface TaskActivityProps {
  workspaceId: string;
  taskId: string;
}

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

export function TaskActivity({ workspaceId, taskId }: TaskActivityProps) {
  const { data, isLoading, isError, refetch } = useTaskActivity(workspaceId, taskId);

  let content: ReactNode;

  if (isError) {
    content = (
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load activity</p>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading this section.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  } else if (isLoading) {
    content = (
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
  } else if (data.length === 0) {
    content = (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Updates to this task will appear here."
      />
    );
  } else {
    content = (
      <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
        {data.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <h3 className="text-sm font-medium">Activity</h3>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
