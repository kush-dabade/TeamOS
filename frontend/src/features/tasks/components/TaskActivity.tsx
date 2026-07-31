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
      <CardHeader className="mb-5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          Activity
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {data.length}
          </span>
        </h3>
      </CardHeader>
      <CardContent>
        <ActivityFeed
          activities={data}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyTitle="No activity yet"
          emptyDescription="Updates to this task will appear here."
          // Fixed height (not max-h) so a task with only 1-2 events still
          // reserves the same footprint as a full feed, instead of the box
          // collapsing and leaving the Card looking unfinished next to
          // Comments/Attachments in the collaboration grid.
          className="h-80 overflow-y-auto pr-1"
        />
      </CardContent>
    </Card>
  );
}
