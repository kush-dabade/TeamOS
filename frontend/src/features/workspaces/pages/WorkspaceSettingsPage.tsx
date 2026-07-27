import { TriangleAlert } from "lucide-react";

import { PageHeader, PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ErrorState, PageError } from "@/components/ux";

import { WorkspaceGeneralSettingsCard } from "../components/workspace-general-settings-card";
import { WorkspaceGeneralSettingsCardSkeleton } from "../components/workspace-general-settings-card-skeleton";
import { WorkspaceInvitationsCard } from "../components/workspace-invitations-card";
import { WorkspaceMembersCard } from "../components/workspace-members-card";
import { useCurrentWorkspace } from "../hooks/use-current-workspace";
import { useWorkspace } from "../hooks/use-workspace";

export function WorkspaceSettingsPage() {
  const currentWorkspaceQuery = useCurrentWorkspace();
  const workspaceQuery = useWorkspace(currentWorkspaceQuery.data?.id);

  return (
    <PageLayout>
      <PageHeader
        title="Workspace Settings"
        description="Manage your workspace's name, members, and settings."
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
        <div className="mt-6 flex max-w-2xl flex-col gap-6">
          {workspaceQuery.isPending ? (
            <WorkspaceGeneralSettingsCardSkeleton />
          ) : workspaceQuery.data ? (
            <>
              <WorkspaceGeneralSettingsCard workspace={workspaceQuery.data} />
              <WorkspaceMembersCard workspace={workspaceQuery.data} />
              <WorkspaceInvitationsCard workspace={workspaceQuery.data} />
            </>
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}
