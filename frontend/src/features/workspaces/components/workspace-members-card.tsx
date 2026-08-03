import { SearchIcon, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ux";

import { useWorkspaceMembers } from "../hooks/use-workspace-members";
import type { Workspace } from "../types";

import { InviteMemberDialog } from "./invite-member-dialog";
import { WorkspaceMemberRow } from "./workspace-member-row";
import { WorkspaceMembersCardSkeleton } from "./workspace-members-card-skeleton";

interface WorkspaceMembersCardProps {
  workspace: Workspace;
}

export function WorkspaceMembersCard({ workspace }: WorkspaceMembersCardProps) {
  const membersQuery = useWorkspaceMembers(workspace.id);
  const [searchQuery, setSearchQuery] = useState("");

  const canManageInvitations = workspace.role === "OWNER" || workspace.role === "ADMIN";

  const filteredMembers = useMemo(() => {
    if (!membersQuery.data) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return membersQuery.data;
    }

    return membersQuery.data.filter(
      (member) =>
        member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query),
    );
  }, [membersQuery.data, searchQuery]);

  if (membersQuery.isPending) {
    return <WorkspaceMembersCardSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Members</CardTitle>

        {canManageInvitations ? (
          <div className="shrink-0">
            <InviteMemberDialog workspaceId={workspace.id} actorRole={workspace.role} />
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-48 flex-col">
        <div className="flex flex-1 flex-col gap-4">
          <div className="relative min-w-0 sm:max-w-sm">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search members..."
              aria-label="Search members"
              className="pl-8"
            />
          </div>

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
            <div className="flex flex-1 flex-col">
              <table className="w-full table-fixed border-collapse text-sm">
                <caption className="sr-only">Workspace members</caption>
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th scope="col" className="truncate px-3 py-2 font-medium">
                      Member
                    </th>
                    <th scope="col" className="w-24 truncate px-3 py-2 font-medium">
                      Role
                    </th>
                    <th scope="col" className="w-20 truncate px-3 py-2 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <WorkspaceMemberRow
                      key={member.id}
                      workspaceId={workspace.id}
                      workspaceName={workspace.name}
                      member={member}
                      actorRole={workspace.role}
                    />
                  ))}
                </tbody>
              </table>

              {searchQuery && filteredMembers.length === 0 ? (
                <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                  No members match your search.
                </div>
              ) : null}

              {!searchQuery && (membersQuery.data?.length ?? 0) <= 1 ? (
                <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                  No additional members yet.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
