import type { WorkspaceRole } from "../types";

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  GUEST: "Guest",
};

// Mirrors workspace.service.ts (canManageMember / canAssignRole) for UX affordances only;
// the backend re-validates every request and remains the source of truth.
export function canManageMember(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (actorRole === "OWNER") {
    return targetRole === "ADMIN" || targetRole === "MEMBER" || targetRole === "GUEST";
  }

  if (actorRole === "ADMIN") {
    return targetRole === "MEMBER" || targetRole === "GUEST";
  }

  return false;
}

export function getAssignableRoles(actorRole: WorkspaceRole): WorkspaceRole[] {
  if (actorRole === "OWNER") {
    return ["ADMIN", "MEMBER", "GUEST"];
  }

  if (actorRole === "ADMIN") {
    return ["MEMBER", "GUEST"];
  }

  return [];
}

// Mirrors workspace.service.ts (transferWorkspaceOwnership) for UX affordances only; guests have
// read-only access (docs/architecture/api-specification.md, RBAC Rules), so they're excluded as
// ownership-transfer targets. The backend re-validates every request and remains the source of
// truth.
export function isEligibleOwnershipTransferTarget(targetRole: WorkspaceRole): boolean {
  return targetRole === "ADMIN" || targetRole === "MEMBER";
}
