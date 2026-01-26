/*
  Warnings:

  - You are about to drop the column `banned` on the `SlowUsers` table. All the data in the column will be lost.
  - You are about to drop the column `messageCount` on the `Slowmode` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[channel,threadTs,user]` on the table `SlowUsers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[channel,threadTs]` on the table `Slowmode` will be added. If there are existing duplicate values, this will fail.
  - Made the column `channel` on table `SlowUsers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user` on table `SlowUsers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `channel` on table `Slowmode` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "SlowUsers_channel_user_key";

-- AlterTable
ALTER TABLE "SlowUsers" DROP COLUMN "banned",
ADD COLUMN     "threadTs" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "channel" SET NOT NULL,
ALTER COLUMN "user" SET NOT NULL;

-- RenameColumn
ALTER TABLE "SlowUsers" RENAME COLUMN "count" TO "lastMessageAt";

-- AlterTable
ALTER TABLE "Slowmode" DROP COLUMN "messageCount",
ADD COLUMN     "admin" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "threadTs" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "whitelistedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "channel" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SlowUsers_channel_threadTs_user_key" ON "SlowUsers"("channel", "threadTs", "user");

-- CreateIndex
CREATE UNIQUE INDEX "Slowmode_channel_threadTs_key" ON "Slowmode"("channel", "threadTs");
