-- CreateIndex
-- Uses CONCURRENTLY so this build doesn't hold the ACCESS EXCLUSIVE-adjacent
-- lock a plain CREATE INDEX takes against concurrent writes to Task. This is
-- the migration's only statement, so Prisma Migrate applies it outside a
-- transaction (it only wraps multi-statement migration files) - required,
-- since CONCURRENTLY is rejected by Postgres inside a transaction block.
CREATE INDEX CONCURRENTLY "Task_projectId_deletedAt_createdAt_id_idx" ON "Task"("projectId", "deletedAt", "createdAt", "id");
