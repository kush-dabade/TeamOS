import { z } from "zod";

export const notificationParamsSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required"),
});

export type NotificationParamsInput = z.infer<typeof notificationParamsSchema>;
