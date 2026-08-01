import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldTitle } from "@/components/ui/field";
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
      <CardHeader>
        <CardTitle className="truncate">{invitation.workspaceName}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldTitle className="text-muted-foreground">Invited by</FieldTitle>
            <FieldContent className="flex-none">
              <p className="truncate text-sm">{invitation.invitedByName}</p>
            </FieldContent>
          </Field>

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
      </CardContent>
    </Card>
  );
}
