-- AlterEnum
-- Adds the activity type for restoring an archived project back to ACTIVE
-- (restoreProject in project.service.ts). Mirrors the existing
-- PROJECT_ARCHIVED value's role for the opposite transition; restoration
-- always targets ACTIVE - the Project model has no pre-archive-status field
-- to recover, so there is no other target status to represent.
ALTER TYPE "ActivityType" ADD VALUE 'PROJECT_RESTORED';
