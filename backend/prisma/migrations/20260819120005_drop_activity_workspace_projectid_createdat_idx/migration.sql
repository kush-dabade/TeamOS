-- DropIndex
-- Same rationale as 20260819120003_drop_activity_workspace_createdat_idx -
-- runs after Activity_workspaceId_projectId_createdAt_id_idx already exists
-- and fully covers every query this index served.
DROP INDEX CONCURRENTLY "Activity_workspaceId_projectId_createdAt_idx";
