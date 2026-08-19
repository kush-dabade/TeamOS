-- CreateIndex
-- Same rationale as 20260819120000_add_activity_workspace_pagination_index -
-- supersedes "Activity_workspaceId_taskId_createdAt_idx" (adds "id" so the
-- taskId-filtered activity listing is also deterministic on tied
-- createdAt values), dropped separately in a later migration.
CREATE INDEX CONCURRENTLY "Activity_workspaceId_taskId_createdAt_id_idx" ON "Activity"("workspaceId", "taskId", "createdAt" DESC, "id" DESC);
