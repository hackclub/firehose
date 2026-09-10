import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma } from '../../utils/prismaConnector.js';

export default async function messageIndexListener({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs): Promise<void> {
    if (!payload || payload.type !== 'message' || !('user' in payload) || !payload.user) {
        return;
    }

    if (payload.subtype && payload.subtype !== 'thread_broadcast') {
        return;
    }

    const sentAt = new Date(parseFloat(payload.ts) * 1000);
    if (Number.isNaN(sentAt.getTime())) return;

    const prisma = getPrisma();
    try {
        await prisma.messageIndex.upsert({
            where: { channel_ts: { channel: payload.channel, ts: payload.ts } },
            update: {},
            create: {
                user: payload.user,
                channel: payload.channel,
                ts: payload.ts,
                threadTs: payload.thread_ts ?? null,
                sentAt,
            },
        });
    } catch (e) {
        console.error('[nuke] failed to index message:', e);
    }
}
