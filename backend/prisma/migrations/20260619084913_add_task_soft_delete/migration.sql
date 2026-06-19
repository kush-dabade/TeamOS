-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'TASK_DELETED';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");
