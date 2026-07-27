import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ux";

import { useWorkspaceInvitations } from "../hooks/use-workspace-invitations";
import type { Workspace } from "../types";

import { WorkspaceInvitationRow } from "./workspace-invitation-row";
import { WorkspaceInvitationsCardSkeleton } from "./workspace-invitations-card-skeleton";
import { WorkspaceInviteForm } from "./workspace-invite-form";

interface WorkspaceInvitationsCardProps {
  workspace: Workspace;
}

export function WorkspaceInvitationsCard({ workspace }: WorkspaceInvitationsCardProps) {
  const canManageInvitations = workspace.role === "OWNER" || workspace.role === "ADMIN";
  const invitationsQuery = useWorkspaceInvitations(workspace.id, canManageInvitations);

  if (!canManageInvitations) {
    return null;
  }

  if (invitationsQuery.isPending) {
    return <WorkspaceInvitationsCardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-6">
          <WorkspaceInviteForm workspaceId={workspace.id} actorRole={workspace.role} />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Pending Invitations</h3>

            {invitationsQuery.isError ? (
              <ErrorState
                icon={TriangleAlert}
                title="Unable to load invitations"
                description="Something went wrong while loading pending invitations. Check your connection and try again."
                action={
                  <Button type="button" variant="outline" onClick={() => invitationsQuery.refetch()}>
                    Retry
                  </Button>
                }
              />
            ) : invitationsQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <caption className="sr-only">Pending workspace invitations</caption>
                  <thead className="text-left text-xs font-medium text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Role
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Expires
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitationsQuery.data.map((invitation) => (
                      <WorkspaceInvitationRow
                        key={invitation.id}
                        workspaceId={workspace.id}
                        invitation={invitation}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
