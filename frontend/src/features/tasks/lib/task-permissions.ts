import type { WorkspaceRole } from "@/features/workspaces";

// Mirrors task.service.ts's GUEST checks (createTask/updateTask/deleteTask
// all throw ForbiddenError for GUEST) for UX affordances only - the backend
// re-validates every request and remains the source of truth. Undefined
// (role not yet resolved) is treated as "cannot manage" so a control is
// never shown before permission is actually known.
export function canManageTasks(role: WorkspaceRole | undefined): boolean {
  return role !== undefined && role !== "GUEST";
}
