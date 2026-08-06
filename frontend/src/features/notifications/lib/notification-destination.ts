import type { Notification } from "../types";

// Resolves the in-app route a notification should navigate to when clicked.
// Only types with an unambiguous, safe destination are handled here - e.g.
// INVITATION_RECEIVED's metadata has an invitationId but invitations are
// accepted via a token (/invitations/:token), not this id, so it has no
// destination yet. Metadata is untyped JSON from the backend, so fields are
// narrowed at runtime rather than trusted - a missing or malformed taskId
// falls back to null (mark-read-only) instead of navigating to a bad route.
export function getNotificationDestination(notification: Notification): string | null {
  switch (notification.type) {
    case "TASK_ASSIGNED":
    case "COMMENT_ON_ASSIGNED_TASK": {
      const taskId = notification.metadata?.taskId;
      return typeof taskId === "string" ? `/tasks/${taskId}` : null;
    }

    default:
      return null;
  }
}
