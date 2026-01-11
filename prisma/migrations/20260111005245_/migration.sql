/*
  Warnings:

  - You are about to drop the column `banned` on the `SlowUsers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SlowUsers" DROP COLUMN "banned";

-- AlterTable
ALTER TABLE "Slowmode" ADD COLUMN     "admin" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
