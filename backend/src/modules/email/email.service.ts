import { resend } from "./email.client.js";
import { emailConfig } from "./email.config.js";
import { passwordResetTemplate } from "./templates/reset-password.js";
import { verifyEmailTemplate } from "./templates/verify-email.js";
import { workspaceInvitationTemplate } from "./templates/workspace-invitation.js";
import type {
  EmailTemplate,
  SendPasswordResetEmailData,
  SendVerificationEmailData,
  SendWorkspaceInvitationEmailData,
} from "./email.types.js";

async function sendEmail(
  recipientEmail: string,
  email: EmailTemplate,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: emailConfig.from,
    to: recipientEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (error) {
    throw error;
  }
}

export async function sendWorkspaceInvitation(
  data: SendWorkspaceInvitationEmailData,
): Promise<void> {
  const invitationUrl = `${emailConfig.frontendUrl}/invitations/${data.invitationToken}`;

  const expiresText = `Expires on ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(data.expiresAt)}`;

  const email = workspaceInvitationTemplate({
    workspaceName: data.workspaceName,
    invitedByName: data.invitedByName,
    role: data.role,
    invitationUrl,
    expiresText,
  });

  await sendEmail(data.recipientEmail, email);
}

export async function sendVerificationEmail(
  data: SendVerificationEmailData,
): Promise<void> {
  const email = verifyEmailTemplate({
    recipientName: data.recipientName,
    verificationUrl: data.verificationUrl,
  });

  await sendEmail(data.recipientEmail, email);
}

export async function sendPasswordResetEmail(
  data: SendPasswordResetEmailData,
): Promise<void> {
  const email = passwordResetTemplate({
    recipientName: data.recipientName,
    resetUrl: data.resetUrl,
  });

  await sendEmail(data.recipientEmail, email);
}