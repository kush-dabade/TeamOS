export const NOTIFICATION_JOB_NAMES = {
  CREATE_NOTIFICATION: "create-notification",
} as const;

export type NotificationJobName =
  (typeof NOTIFICATION_JOB_NAMES)[keyof typeof NOTIFICATION_JOB_NAMES];