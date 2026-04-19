/*
  Warnings:

  - You are about to drop the column `time` on the `Bans` table. All the data in the column will be lost.
  - You are about to drop the column `number_of_messages` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `time_banned` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `time_nlp` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bans" DROP COLUMN "time",
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "number_of_messages",
DROP COLUMN "time_banned",
DROP COLUMN "time_nlp",
ADD COLUMN     "expiresAt" TIMESTAMP(3);
