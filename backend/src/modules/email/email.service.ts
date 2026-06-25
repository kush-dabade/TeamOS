import type { SendWorkspaceInvitationEmailData } from "./email.types.js";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

export async function sendWorkspaceInvitation(
  data: SendWorkspaceInvitationEmailData,
): Promise<void> {
  const invitationUrl = `${FRONTEND_URL}/invitations/${data.invitationToken}`;
  console.log(`
========================================
📧 TeamOS Workspace Invitation

To: ${data.recipientEmail}

Subject: You've been invited to join ${data.workspaceName}

${data.invitedByName} has invited you to join the workspace "${data.workspaceName}" as a ${data.role}.

Accept your invitation:
${invitationUrl}

========================================
`);
}
