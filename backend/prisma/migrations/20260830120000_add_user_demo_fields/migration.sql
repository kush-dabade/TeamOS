-- AlterTable
ALTER TABLE "user" ADD COLUMN     "demoExpiresAt" TIMESTAMP(3),
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "user_isDemo_demoExpiresAt_idx" ON "user"("isDemo", "demoExpiresAt");
