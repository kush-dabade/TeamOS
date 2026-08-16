import { TriangleAlert } from "lucide-react";

import { PageHeader, PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ErrorState, PageError } from "@/components/ux";

import { WorkspaceDetailsCard } from "../components/workspace-details-card";
import { WorkspaceDetailsCardSkeleton } from "../components/workspace-details-card-skeleton";
import { WorkspaceInvitationsCard } from "../components/workspace-invitations-card";
import { WorkspaceMembersCard } from "../components/workspace-members-card";
import { WorkspaceMembersCardSkeleton } from "../components/workspace-members-card-skeleton";
import { useActiveWorkspace } from "../hooks/use-active-workspace";
import { useWorkspace } from "../hooks/use-workspace";

export function WorkspaceSettingsPage() {
  const { workspaceId } = useActiveWorkspace();
  const workspaceQuery = useWorkspace(workspaceId ?? undefined);

  const isPending = workspaceQuery.isPending;
  const isError = workspaceQuery.isError;

  function handleRetry() {
    workspaceQuery.refetch();
  }

  return (
    <PageLayout>
      <PageHeader
        title="Workspace settings"
        description="Manage this workspace's details, members, and invitations."
      />

      {isError ? (
        <PageError>
          <ErrorState
            icon={TriangleAlert}
            title="Unable to load workspace settings"
            description="Something went wrong while loading your workspace settings. Check your connection and try again."
            action={
              <Button type="button" onClick={handleRetry}>
                Retry
              </Button>
            }
          />
        </PageError>
      ) : (
        <div className="mt-3 flex flex-col gap-6">
          {isPending ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <WorkspaceDetailsCardSkeleton />
              <WorkspaceMembersCardSkeleton />
            </div>
          ) : workspaceQuery.data ? (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <WorkspaceDetailsCard workspace={workspaceQuery.data} />
                <WorkspaceMembersCard workspace={workspaceQuery.data} />
              </div>

              <WorkspaceInvitationsCard workspace={workspaceQuery.data} />
            </>
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}
