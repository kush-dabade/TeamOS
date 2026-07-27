import { TriangleAlert } from "lucide-react";

import { PageHeader, PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ErrorState, PageError } from "@/components/ux";

import { WorkspaceGeneralSettingsCard } from "../components/workspace-general-settings-card";
import { WorkspaceGeneralSettingsCardSkeleton } from "../components/workspace-general-settings-card-skeleton";
import { useCurrentWorkspace } from "../hooks/use-current-workspace";
import { useWorkspace } from "../hooks/use-workspace";

export function WorkspaceSettingsPage() {
  const currentWorkspaceQuery = useCurrentWorkspace();
  const workspaceQuery = useWorkspace(currentWorkspaceQuery.data?.id);

  return (
    <PageLayout>
      <PageHeader
        title="Workspace Settings"
        description="Manage your workspace's name and view its details."
      />

      {workspaceQuery.isError ? (
        <PageError>
          <ErrorState
            icon={TriangleAlert}
            title="Unable to load workspace settings"
            description="Something went wrong while loading your workspace settings. Check your connection and try again."
            action={
              <Button type="button" onClick={() => workspaceQuery.refetch()}>
                Retry
              </Button>
            }
          />
        </PageError>
      ) : (
        <div className="mt-6 max-w-2xl">
          {workspaceQuery.isPending ? (
            <WorkspaceGeneralSettingsCardSkeleton />
          ) : workspaceQuery.data ? (
            <WorkspaceGeneralSettingsCard workspace={workspaceQuery.data} />
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}
