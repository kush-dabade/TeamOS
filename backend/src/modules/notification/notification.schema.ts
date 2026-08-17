import { z } from "zod";

export const notificationParamsSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required"),
});

export type NotificationParamsInput = z.infer<typeof notificationParamsSchema>;

export const listNotificationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().max(50).default(20),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuerySchema>;

// Decoded shape of the opaque `cursor` query param - validated separately
// from the query schema above, since the cursor is only ever a Base64 blob
// until decoded (see notification.service.ts's decodeNotificationCursor).
export const notificationCursorSchema = z.object({
  createdAt: z.coerce.date(),
  id: z.string().min(1),
});

export type NotificationCursorInput = z.infer<typeof notificationCursorSchema>;
