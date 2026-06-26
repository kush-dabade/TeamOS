import type { WorkspaceRole } from "../../generated/prisma/enums.js";

export interface WorkspaceInvitationEmailJob {
  invitationId: string;
  email: string;
  workspaceName: string;
  role: WorkspaceRole;
  invitedByName: string;
  token: string;
  expiresAt: string;
}