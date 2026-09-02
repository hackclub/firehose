-- CreateTable
CREATE TABLE "AutoresponseCooldown" (
    "userId" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoresponseCooldown_pkey" PRIMARY KEY ("userId")
);
