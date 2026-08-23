-- AlterEnum
-- Adds the activity types for administrative workspace-member changes.
-- Distinct from the existing MEMBER_LEFT (voluntary departure, see
-- leaveWorkspace in workspace.service.ts): MEMBER_REMOVED is an admin/owner
-- removing another member, MEMBER_ROLE_CHANGED is an admin/owner changing
-- another member's role. MEMBER_REMOVED is declared here ahead of
-- removeWorkspaceMember actually emitting it - see that function's own
-- comment in workspace.service.ts for why the emission itself waits for a
-- later change.
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_REMOVED';
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_ROLE_CHANGED';
