-- AlterEnum
-- Adds the activity type for project-level ownership transfer
-- (transferProjectOwnership in project.service.ts). Distinct from the
-- existing OWNERSHIP_TRANSFERRED value, which is workspace-ownership-
-- specific (see its matching realtime constant's literal string,
-- "workspace.ownership_transferred") - reusing it here would misrepresent
-- a project-level change as a workspace-level one.
ALTER TYPE "ActivityType" ADD VALUE 'PROJECT_OWNERSHIP_TRANSFERRED';
