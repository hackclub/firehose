CREATE TABLE "MessageIndex" (
    "id" SERIAL NOT NULL,
    "user" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "ts" TEXT NOT NULL,
    "threadTs" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageIndex_channel_ts_key" ON "MessageIndex"("channel", "ts");

CREATE INDEX "MessageIndex_user_sentAt_idx" ON "MessageIndex"("user", "sentAt");

CREATE INDEX "MessageIndex_sentAt_idx" ON "MessageIndex"("sentAt");

CREATE INDEX "MessageIndex_channel_threadTs_idx" ON "MessageIndex"("channel", "threadTs");
