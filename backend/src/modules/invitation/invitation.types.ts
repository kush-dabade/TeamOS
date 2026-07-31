import type {
  InvitationStatus,
  WorkspaceRole,
} from "../../generated/prisma/enums.js";

export type InvitationResponse = {
  id: string;

  workspaceId: string;

  email: string;

  role: WorkspaceRole;

  invitedById: string;

  status: InvitationStatus;

  expiresAt: Date;

  createdAt: Date;
};

export interface CreateInvitationData {
  workspaceId: string;

  email: string;

  role: WorkspaceRole;

  invitedById: string;
}

export type InvitationPreviewResponse = {
  workspaceName: string;

  invitedByName: string;

  email: string;

  role: WorkspaceRole;

  status: InvitationStatus;

  expiresAt: Date;
};
