export const EMAIL_JOB_NAMES = {
  WORKSPACE_INVITATION: "workspace-invitation",
  EMAIL_VERIFICATION: "email-verification",
  PASSWORD_RESET: "password-reset",
} as const;

export type EmailJobName =
  (typeof EMAIL_JOB_NAMES)[keyof typeof EMAIL_JOB_NAMES];