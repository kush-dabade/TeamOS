export interface SendWorkspaceInvitationEmailData {
  recipientEmail: string;
  workspaceName: string;
  invitedByName: string;
  role: string;
  invitationToken: string;
  expiresAt: Date;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface WorkspaceInvitationTemplateData {
  workspaceName: string;
  invitedByName: string;
  role: string;
  invitationUrl: string;
  expiresText: string;
}

export interface SendVerificationEmailData {
  recipientEmail: string;
  recipientName: string;
  verificationUrl: string;
}

export interface VerifyEmailTemplateData {
  recipientName: string;
  verificationUrl: string;
}
