import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
import { WorkspaceAvatar } from "@/features/workspaces/components/workspace-avatar";
import { WorkspaceRoleBadge } from "@/features/workspaces/components/workspace-role-badge";
import { formatDate } from "@/utils/formatDate";

import type { InvitationPreview } from "../types";

import { InvitationStatusBadge } from "./invitation-status-badge";

interface InvitationPreviewCardProps {
  invitation: InvitationPreview;
}

export function InvitationPreviewCard({ invitation }: InvitationPreviewCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col items-center gap-2 text-center">
        <WorkspaceAvatar name={invitation.workspaceName} className="size-12 text-base" />

        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">You're invited to join</p>
          <CardTitle className="truncate text-xl font-semibold">
            {invitation.workspaceName}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{invitation.invitedByName}</span>{" "}
            invited you to join this workspace.
          </p>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <Field orientation="horizontal">
              <FieldTitle className="text-muted-foreground">Role</FieldTitle>
              <FieldContent className="flex-none">
                <WorkspaceRoleBadge role={invitation.role} />
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldTitle className="text-muted-foreground">Status</FieldTitle>
              <FieldContent className="flex-none">
                <InvitationStatusBadge status={invitation.status} />
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldTitle className="text-muted-foreground">Expires</FieldTitle>
              <FieldContent className="flex-none">
                <p className="text-sm">{formatDate(invitation.expiresAt)}</p>
              </FieldContent>
            </Field>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
