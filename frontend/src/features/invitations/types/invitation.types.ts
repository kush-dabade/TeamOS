import type { InvitationStatus, WorkspaceRole } from "@/features/workspaces/types";

export interface InvitationPreview {
  workspaceName: string;
  invitedByName: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  expiresAt: string;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}
