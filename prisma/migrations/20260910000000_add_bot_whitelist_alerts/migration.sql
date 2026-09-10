CREATE TABLE "BotWhitelistAlert" (
    "channelId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "logMessageTs" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotWhitelistAlert_pkey" PRIMARY KEY ("channelId", "botId")
);

CREATE INDEX "BotWhitelistAlert_expiresAt_idx" ON "BotWhitelistAlert"("expiresAt");
