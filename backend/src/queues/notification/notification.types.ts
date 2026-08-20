import type { NotificationType } from "../../generated/prisma/enums.js";

export interface CreateNotificationJobData {
  workspaceId: string;

  recipientId: string;

  type: NotificationType;

  title: string;
  message: string;

  metadata?: Record<string, unknown>;

  /**
   * Stable identity of the specific triggering event, chosen by each call
   * site (see notification.queue.ts's enqueueNotification for how this
   * becomes the BullMQ jobId, and each call site for why its own value is
   * safe): a one-time entity's own id where the underlying event can only
   * ever happen once for that id (a freshly-created comment/task/invitation
   * - the id itself already uniquely identifies the event), or
   * `${entityId}-${entity.updatedAt.getTime()}` where the same entity can
   * legitimately generate the same *kind* of event again later (ownership
   * transferred again, a task reassigned again) - the timestamp is what
   * makes each occurrence distinct rather than colliding with a prior one.
   */
  eventId: string;
}