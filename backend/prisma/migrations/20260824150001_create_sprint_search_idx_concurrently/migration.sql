-- CreateIndex
-- Recreates Sprint_search_idx (dropped in the prior migration,
-- 20260824150000_drop_sprint_search_idx_concurrently) with CONCURRENTLY, so
-- this build doesn't hold the ACCESS EXCLUSIVE-adjacent lock a plain CREATE
-- INDEX takes against concurrent writes to Sprint. This is the migration's
-- only statement, so Prisma Migrate applies it outside a transaction (it
-- only wraps multi-statement migration files) - required, since CONCURRENTLY
-- is rejected by Postgres inside a transaction block. Index definition is
-- otherwise identical to the one it replaces.
CREATE INDEX CONCURRENTLY "Sprint_search_idx"
ON "Sprint"
USING GIN (
    to_tsvector(
        'simple',
        "name" || ' ' || coalesce("goal", '')
    )
);
