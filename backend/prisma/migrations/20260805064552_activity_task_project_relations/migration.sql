-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_workspaceId_taskId_createdAt_idx" ON "Activity"("workspaceId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_workspaceId_projectId_createdAt_idx" ON "Activity"("workspaceId", "projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
