import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ux";

import { useWorkspaceMembers } from "../hooks/use-workspace-members";
import type { Workspace } from "../types";

import { WorkspaceMemberRow } from "./workspace-member-row";
import { WorkspaceMembersCardSkeleton } from "./workspace-members-card-skeleton";

interface WorkspaceMembersCardProps {
  workspace: Workspace;
}

export function WorkspaceMembersCard({ workspace }: WorkspaceMembersCardProps) {
  const membersQuery = useWorkspaceMembers(workspace.id);

  if (membersQuery.isPending) {
    return <WorkspaceMembersCardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>

      <CardContent>
        {membersQuery.isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Unable to load members"
            description="Something went wrong while loading workspace members. Check your connection and try again."
            action={
              <Button type="button" variant="outline" onClick={() => membersQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <caption className="sr-only">Workspace members</caption>
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-1/2 px-3 py-2 font-medium">
                      Member
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {membersQuery.data.map((member) => (
                    <WorkspaceMemberRow
                      key={member.id}
                      workspaceId={workspace.id}
                      member={member}
                      actorRole={workspace.role}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {membersQuery.data.length <= 1 ? (
              <p className="text-center text-sm text-muted-foreground">
                No additional members yet.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
