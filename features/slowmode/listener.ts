import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    isUserExempt,
    deleteMessage,
    postEphemeral,
    logInternal,
    getThreadLink,
} from '../../utils/index.js';

async function enforceSlowMode({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!payload || payload.type !== 'message' || !('user' in payload)) {
        return;
    }
    const { user, ts, text, channel, subtype } = payload;
    const thread_ts = 'thread_ts' in payload ? payload.thread_ts : undefined;

    if (subtype) return;

    const prisma = getPrisma();

    let slowmodeConfig = null;

    if (thread_ts) {
        slowmodeConfig = await prisma.slowmode.findFirst({
            where: {
                channel: channel,
                threadTs: thread_ts,
                locked: true,
            },
        });
    }
    if (!slowmodeConfig) {
        slowmodeConfig = await prisma.slowmode.findFirst({
            where: {
                channel: channel,
                threadTs: '',
                locked: true,
            },
        });

        if (slowmodeConfig && thread_ts && !slowmodeConfig.applyToThreads) {
            return;
        }
    }

    if (!slowmodeConfig) return;

    if (slowmodeConfig.expiresAt && new Date() > slowmodeConfig.expiresAt) {
        await Promise.all([
            prisma.slowmode.update({
                where: {
                    id: slowmodeConfig.id,
                },
                data: {
                    locked: false,
                },
            }),
            prisma.slowUsers.deleteMany({
                where: { channel: channel, threadTs: slowmodeConfig.threadTs },
            }),
        ]);

        const locationText = slowmodeConfig.threadTs
            ? `a thread in <#${channel}>.\nLink: ${getThreadLink(channel, slowmodeConfig.threadTs)}`
            : `<#${channel}>.`;

        await logInternal(`Slowmode expired in ${locationText}`);

        return;
    }

    const isExempt = await isUserExempt(user, channel, slowmodeConfig.whitelistedUsers || []);
    if (isExempt) return;

    const userData = await prisma.slowUsers.findFirst({
        where: {
            channel: channel,
            threadTs: slowmodeConfig.threadTs,
            user: user,
        },
    });

    const now = Date.now();

    if (!userData) {
        await prisma.slowUsers.create({
            data: {
                channel: channel,
                threadTs: slowmodeConfig.threadTs,
                user: user,
                lastMessageAt: Math.floor(now / 1000),
            },
        });
        return;
    }

    const timeSinceLastMessage = Math.floor(now / 1000) - (userData.lastMessageAt || 0);

    if (timeSinceLastMessage < (slowmodeConfig.time || 0)) {
        const timeRemaining = Math.ceil((slowmodeConfig.time || 0) - timeSinceLastMessage);
        try {
            await deleteMessage(channel, ts);
        } catch (e) {
            console.error(`An error occured: ${e}`);
        }

        await postEphemeral(
            channel,
            user,
            `Slowmode is active. You can send another message in ${timeRemaining} seconds.${text ? `\n\nYour message was:\n${text}` : ''}`,
            thread_ts
        );
    } else {
        await prisma.slowUsers.upsert({
            where: {
                channel_threadTs_user: {
                    channel: channel,
                    threadTs: slowmodeConfig.threadTs,
                    user: user,
                },
            },
            create: {
                channel: channel,
                threadTs: slowmodeConfig.threadTs,
                user: user,
                lastMessageAt: Math.floor(now / 1000),
            },
            update: {
                lastMessageAt: Math.floor(now / 1000),
            },
        });
    }
}

export default enforceSlowMode;
