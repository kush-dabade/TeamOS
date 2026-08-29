import { logger } from "../../lib/logger.js";
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
  // resend is null exactly when emailConfig.enabled is false - local
  // development without RESEND_API_KEY/EMAIL_FROM configured (see
  // email.client.ts). The worker process itself must stay healthy in that
  // case; a job that can't actually send just completes as a deliberate
  // no-op instead of throwing into BullMQ's retry/backoff path for
  // something that will never succeed without credentials. Production
  // always has resend configured (guarded by email.config.ts's own
  // fail-fast), so this branch never runs there.
  if (!resend) {
    logger.warn(
      { recipientEmail, subject: email.subject },
      "Skipping email send: RESEND_API_KEY/EMAIL_FROM not configured (local development only).",
    );

    return;
  }

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