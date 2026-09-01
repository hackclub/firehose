-- CreateTable
CREATE TABLE "BotWhitelist" (
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "botIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "BotWhitelist_pkey" PRIMARY KEY ("channelId")
);
