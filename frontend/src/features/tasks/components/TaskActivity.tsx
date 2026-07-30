import { Card, CardContent, CardHeader } from "@/components/ui";
import { ActivityFeed, useTaskActivity } from "@/features/activity";

interface TaskActivityProps {
  workspaceId: string;
  taskId: string;
}

export function TaskActivity({ workspaceId, taskId }: TaskActivityProps) {
  const { data, isLoading, isError, refetch } = useTaskActivity(workspaceId, taskId);

  return (
    <Card size="sm">
      <CardHeader>
        <h3 className="text-sm font-medium">Activity</h3>
      </CardHeader>
      <CardContent>
        <ActivityFeed
          activities={data}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyTitle="No activity yet"
          emptyDescription="Updates to this task will appear here."
          className="max-h-64 overflow-y-auto pr-1"
        />
      </CardContent>
    </Card>
  );
}
