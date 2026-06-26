export const EMAIL_JOB_NAMES = {
  WORKSPACE_INVITATION: "workspace-invitation",
} as const;

export type EmailJobName =
  (typeof EMAIL_JOB_NAMES)[keyof typeof EMAIL_JOB_NAMES];