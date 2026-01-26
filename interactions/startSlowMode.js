const { getPrisma } = require('../utils/prismaConnector');
const getChannelManagers = require('../utils/isChannelManger');
const { env } = require('../utils/env');

// Use a cache for user info so a very fast thread (or someone spamming) doesn't hit rate limits
/** @type {Map<string, {isAdmin: boolean, expiresAt: number}>} */
const userInfoCache = new Map();
const USER_CACHE_TTL_MS = 60 * 1000;

/** @param {import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs} args */
async function startSlowMode(args) {
    const { client, payload } = args;
    const event =
        /** @type {{user: string, ts: string, text: string, channel: string, subtype?: string, thread_ts?: string}} */ (
            payload
        );
    const { user, ts, text, channel, subtype, thread_ts } = event;

    if (subtype) return;

    const prisma = getPrisma();

    let getSlowmode = null;

    if (thread_ts) {
        getSlowmode = await prisma.slowmode.findFirst({
            where: {
                channel: channel,
                threadTs: thread_ts,
                locked: true,
            },
        });
    }

    if (!getSlowmode) {
        getSlowmode = await prisma.slowmode.findFirst({
            where: {
                channel: channel,
                threadTs: '',
                locked: true,
            },
        });
    }

    if (!getSlowmode) return;

    if (getSlowmode.expiresAt && new Date() > getSlowmode.expiresAt) {
        await Promise.all([
            prisma.slowmode.update({
                where: {
                    id: getSlowmode.id,
                },
                data: {
                    locked: false,
                },
            }),
            prisma.slowUsers.deleteMany({
                where: { channel: channel },
            }),
        ]);

        const locationText = getSlowmode.threadTs
            ? `https://hackclub.slack.com/archives/${channel}/p${(thread_ts || '').toString().replace('.', '')}`
            : `<#${channel}>`;

        // TODO: add a cron job for SlowUsers cleanup and automatic expiry messages
        await client.chat.postMessage({
            channel: env.MIRRORCHANNEL,
            text: `Slowmode auto-disabled in ${locationText} (expired)`,
        });

        return;
    }

    const cached = userInfoCache.get(user);
    let isAdmin;
    if (cached && cached.expiresAt > Date.now()) {
        isAdmin = cached.isAdmin;
    } else {
        const userInfo = await client.users.info({ user: user });
        isAdmin = userInfo.user?.is_admin || false;
        userInfoCache.set(user, { isAdmin, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    }
    const isManager = (await getChannelManagers(channel)).includes(user);
    const isWhitelisted = getSlowmode.whitelistedUsers?.includes(user) || false;
    const isExempt = isAdmin || isManager || isWhitelisted;
    if (isExempt) return;

    const userData = await prisma.slowUsers.findFirst({
        where: {
            channel: channel,
            threadTs: getSlowmode.threadTs,
            user: user,
        },
    });

    const now = Date.now();

    if (!userData) {
        await prisma.slowUsers.create({
            data: {
                channel: channel,
                threadTs: getSlowmode.threadTs,
                user: user,
                count: Math.floor(now / 1000),
            },
        });
        return;
    }

    const timeSinceLastMessage = Math.floor(now / 1000) - (userData.count || 0);

    if (timeSinceLastMessage < (getSlowmode.time || 0)) {
        const timeRemaining = Math.ceil((getSlowmode.time || 0) - timeSinceLastMessage);
        try {
            await client.chat.delete({
                channel: channel,
                ts: ts,
                token: env.SLACK_USER_TOKEN,
            });
        } catch (e) {
            console.error(`An error occured: ${e}`);
        }

        await client.chat.postEphemeral({
            channel: channel,
            user: user,
            thread_ts: thread_ts,
            text: `Slowmode active: you can send another message in ${timeRemaining} seconds.\n\nYour message was:\n${text}`,
        });
    } else {
        await prisma.slowUsers.upsert({
            where: {
                channel_threadTs_user: {
                    channel: channel,
                    threadTs: getSlowmode.threadTs,
                    user: user,
                },
            },
            create: {
                channel: channel,
                threadTs: getSlowmode.threadTs,
                user: user,
                count: Math.floor(now / 1000),
            },
            update: {
                count: Math.floor(now / 1000),
            },
        });
    }
}

module.exports = startSlowMode;
