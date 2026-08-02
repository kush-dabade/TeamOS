import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import { formatDate } from "@/utils/formatDate";

import { useWorkspaceMembers } from "../hooks/use-workspace-members";
import type { Workspace } from "../types";

import { EditWorkspaceDialog } from "./edit-workspace-dialog";
import { LeaveWorkspaceDialog } from "./leave-workspace-dialog";
import { WorkspaceAvatar } from "./workspace-avatar";
import { WorkspaceRoleBadge } from "./workspace-role-badge";

interface WorkspaceDetailsCardProps {
  workspace: Workspace;
}

export function WorkspaceDetailsCard({ workspace }: WorkspaceDetailsCardProps) {
  const membersQuery = useWorkspaceMembers(workspace.id);
  const isOwner = workspace.role === "OWNER";

  const owner = membersQuery.data?.find((member) => member.role === "OWNER");
  const memberCount = membersQuery.data?.length;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <WorkspaceAvatar name={workspace.name} />

          <div className="min-w-0">
            <CardTitle className="truncate">{workspace.name}</CardTitle>
            <p className="truncate text-sm text-muted-foreground">/{workspace.slug}</p>
          </div>
        </div>

        <div className="shrink-0">
          {isOwner ? (
            <EditWorkspaceDialog workspace={workspace} />
          ) : (
            <LeaveWorkspaceDialog workspaceId={workspace.id} workspaceName={workspace.name} />
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Owner</FieldTitle>
            <FieldContent className="flex-none items-end gap-0 text-right">
              <p className="text-sm">{owner?.name ?? "—"}</p>
              {owner?.email ? (
                <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
              ) : null}
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Your Role</FieldTitle>
            <FieldContent className="flex-none">
              <WorkspaceRoleBadge role={workspace.role} />
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Members</FieldTitle>
            <FieldContent className="flex-none">
              <p className="text-sm">{memberCount ?? "—"}</p>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Created</FieldTitle>
            <FieldContent className="flex-none">
              <p className="text-sm">{formatDate(workspace.createdAt)}</p>
            </FieldContent>
          </Field>

          {workspace.updatedAt ? (
            <Field orientation="horizontal">
              <FieldTitle className="text-muted-foreground">Last Updated</FieldTitle>
              <FieldContent className="flex-none">
                <p className="text-sm">{formatDate(workspace.updatedAt)}</p>
              </FieldContent>
            </Field>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
