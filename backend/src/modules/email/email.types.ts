export interface SendWorkspaceInvitationEmailData {
  recipientEmail: string;
  workspaceName: string;
  invitedByName: string;
  role: string;
  invitationToken: string;
}
