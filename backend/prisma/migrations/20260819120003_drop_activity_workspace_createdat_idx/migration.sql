-- DropIndex
-- Uses CONCURRENTLY for the same lock-avoidance reason as the CREATE INDEX
-- CONCURRENTLY in 20260819120000_add_activity_workspace_pagination_index.
-- Split into its own single-statement migration file so Prisma Migrate
-- applies it outside a transaction, which Postgres requires for
-- CONCURRENTLY. Runs after the new composite index
-- (Activity_workspaceId_createdAt_id_idx) already exists and fully covers
-- every query this index served, so no query is ever left without index
-- support.
DROP INDEX CONCURRENTLY "Activity_workspaceId_createdAt_idx";
