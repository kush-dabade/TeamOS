-- DropIndex
DROP INDEX "Notification_recipientId_createdAt_idx";

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_id_idx" ON "Notification"("recipientId", "createdAt" DESC, "id" DESC);
