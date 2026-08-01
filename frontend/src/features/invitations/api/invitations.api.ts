import { apiClient, type ApiSuccess } from "@/lib/api";
import type { InvitationStatus, WorkspaceRole } from "@/features/workspaces/types";

import type { Invitation, InvitationPreview } from "../types";

interface BackendInvitationPreview {
  workspaceName: string;
  invitedByName: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  expiresAt: string;
}

function toInvitationPreview(preview: BackendInvitationPreview): InvitationPreview {
  return {
    workspaceName: preview.workspaceName,
    invitedByName: preview.invitedByName,
    email: preview.email,
    role: preview.role,
    status: preview.status,
    expiresAt: preview.expiresAt,
  };
}

interface BackendInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

function toInvitation(invitation: BackendInvitation): Invitation {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    invitedById: invitation.invitedById,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

export async function fetchInvitationPreview(token: string): Promise<InvitationPreview> {
  const response = await apiClient.get<ApiSuccess<BackendInvitationPreview>>(
    `/invitations/token/${token}`,
  );

  return toInvitationPreview(response.data.data);
}

export async function acceptInvitation(token: string): Promise<Invitation> {
  const response = await apiClient.post<ApiSuccess<BackendInvitation>>(
    `/invitations/token/${token}/accept`,
  );

  return toInvitation(response.data.data);
}

export async function declineInvitation(token: string): Promise<Invitation> {
  const response = await apiClient.post<ApiSuccess<BackendInvitation>>(
    `/invitations/token/${token}/decline`,
  );

  return toInvitation(response.data.data);
}
