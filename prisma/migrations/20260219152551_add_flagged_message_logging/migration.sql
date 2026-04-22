-- CreateTable
CREATE TABLE "FlaggedMessage" (
    "id" TEXT NOT NULL,
    "flaggedWord" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "messageTs" TEXT NOT NULL,
    "threadTs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlaggedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlaggedMessage_id_key" ON "FlaggedMessage"("id");
