-- CreateIndex
-- Same rationale as 20260819120000_add_activity_workspace_pagination_index -
-- supersedes "Activity_workspaceId_projectId_createdAt_idx" (adds "id" so
-- the projectId-filtered activity listing is also deterministic on tied
-- createdAt values), dropped separately in a later migration.
CREATE INDEX CONCURRENTLY "Activity_workspaceId_projectId_createdAt_id_idx" ON "Activity"("workspaceId", "projectId", "createdAt" DESC, "id" DESC);
