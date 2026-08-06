import type { Notification } from "../types";

// Resolves the in-app route a notification should navigate to when clicked.
// Only types with an unambiguous, safe destination are handled here - e.g.
// INVITATION_RECEIVED's metadata has an invitationId but invitations are
// accepted via a token (/invitations/:token), not this id, so it has no
// destination yet. Metadata is untyped JSON from the backend, so fields are
// narrowed at runtime rather than trusted - a missing, empty, or malformed
// taskId falls back to null (mark-read-only) instead of navigating to a bad
// route. taskId isn't validated as a CUID here - that's a backend concern,
// and no such format check exists on the frontend elsewhere - but it is
// URL-encoded before being placed in the path, since nothing else guarantees
// it can't contain characters like "/" or "?" that would otherwise change
// which route segment or query string it ends up in.
export function getNotificationDestination(notification: Notification): string | null {
  switch (notification.type) {
    case "TASK_ASSIGNED":
    case "COMMENT_ON_ASSIGNED_TASK": {
      const taskId = notification.metadata?.taskId;
      return typeof taskId === "string" && taskId.length > 0
        ? `/tasks/${encodeURIComponent(taskId)}`
        : null;
    }

    default:
      return null;
  }
}
