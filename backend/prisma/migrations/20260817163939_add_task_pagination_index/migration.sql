-- CreateIndex
CREATE INDEX "Task_projectId_deletedAt_createdAt_id_idx" ON "Task"("projectId", "deletedAt", "createdAt", "id");
