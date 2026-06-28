-- CreateTable
CREATE TABLE "AccountAgeGate" (
    "channelId" TEXT NOT NULL,
    "minAgeDays" INTEGER NOT NULL,
    "setBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountAgeGate_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "MemberJoinDate" (
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MemberJoinDate_pkey" PRIMARY KEY ("userId")
);
