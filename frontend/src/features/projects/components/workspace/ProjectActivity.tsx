import { ActivityFeed, useProjectActivity } from "@/features/activity";

interface ProjectActivityProps {
  workspaceId: string;
  projectId: string;
}

export function ProjectActivity({ workspaceId, projectId }: ProjectActivityProps) {
  const { data, isLoading, isError, refetch } = useProjectActivity(workspaceId, projectId);

  return (
    <ActivityFeed
      activities={data}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      emptyTitle="No activity yet"
      emptyDescription="Updates to this project will appear here."
    />
  );
}
