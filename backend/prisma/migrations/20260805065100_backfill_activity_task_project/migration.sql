-- Data-only migration: backfill Activity.taskId / Activity.projectId for
-- rows that existed before those columns were introduced. Derives both
-- columns from the existing entityType/entityId pair, which keeps its
-- current meaning unchanged. No schema objects are altered.
--
-- Each UPDATE is guarded with "IS NULL" on the column it sets, so re-running
-- this file against an already-backfilled database is a no-op.

-- TASK activities: entityId already IS the task id.
UPDATE "Activity" a
SET "taskId" = a."entityId",
    "projectId" = t."projectId"
FROM "Task" t
WHERE a."entityType" = 'TASK'::"ActivityEntityType"
  AND a."taskId" IS NULL
  AND t.id = a."entityId";

-- COMMENT activities: resolve through Comment -> Task. Comments are
-- soft-deleted (deletedAt), never hard-deleted, so the row always exists.
UPDATE "Activity" a
SET "taskId" = c."taskId",
    "projectId" = t."projectId"
FROM "Comment" c
JOIN "Task" t ON t.id = c."taskId"
WHERE a."entityType" = 'COMMENT'::"ActivityEntityType"
  AND a."taskId" IS NULL
  AND c.id = a."entityId";

-- ATTACHMENT activities: resolve through Attachment -> Task. Attachments are
-- hard-deleted, so a row whose attachment no longer exists simply matches no
-- rows here and is left NULL - no value is invented for it.
UPDATE "Activity" a
SET "taskId" = att."taskId",
    "projectId" = t."projectId"
FROM "Attachment" att
JOIN "Task" t ON t.id = att."taskId"
WHERE a."entityType" = 'ATTACHMENT'::"ActivityEntityType"
  AND a."taskId" IS NULL
  AND att.id = a."entityId";

-- PROJECT activities: entityId already IS the project id. taskId stays NULL.
UPDATE "Activity" a
SET "projectId" = a."entityId"
WHERE a."entityType" = 'PROJECT'::"ActivityEntityType"
  AND a."projectId" IS NULL;

-- SPRINT activities: resolve through Sprint -> Project. taskId stays NULL.
UPDATE "Activity" a
SET "projectId" = s."projectId"
FROM "Sprint" s
WHERE a."entityType" = 'SPRINT'::"ActivityEntityType"
  AND a."projectId" IS NULL
  AND s.id = a."entityId";

-- All remaining entity types (WORKSPACE, MEMBER, INVITATION) have no
-- task/project relationship and are intentionally left untouched - both
-- columns stay NULL from Commit 1.
