const { getPrisma } = require("../utils/prismaConnector")
const getChannelManagers = require("../utils/isChannelManger");
require("dotenv").config();


async function startSlowMode(args) {
    const { client, payload } = args
    const { user, ts, text, channel, subtype, thread_ts } = payload

    if (subtype) return;

    const prisma = getPrisma();

    let getSlowmode = null;

    if (thread_ts) {
        getSlowmode = await prisma.Slowmode.findFirst({
            where: {
                channel: channel,
                threadTs: thread_ts,
                locked: true
            }
        });
    }

    if (!getSlowmode) {
        getSlowmode = await prisma.Slowmode.findFirst({
            where: {
                channel: channel,
                threadTs: "",
                locked: true
            }
        });
    }

    if (!getSlowmode) return;

    if (getSlowmode.expiresAt && new Date() > getSlowmode.expiresAt) {
        await Promise.all([
            prisma.Slowmode.update({
                where: {
                    id: getSlowmode.id
                },
                data: {
                    locked: false
                }
            }),
            prisma.SlowUsers.deleteMany({
                where: { channel: channel }
            })
        ]);

        const locationText = getSlowmode.threadTs
            ? `https://hackclub.slack.com/archives/${channel}/p${thread_ts.toString().replace(".", "")}`
            : `<#${channel}>`

        // TODO: add a cron job for SlowUsers cleanup and automatic expiry messages
        await client.chat.postMessage({
            channel: process.env.MIRRORCHANNEL,
            text: `Slowmode auto-disabled in ${locationText} (expired)`
        });

        return;
    }

    const userInfo = await client.users.info({ user: user });
    const isManager = (await getChannelManagers(channel)).includes(user);
    const isAdmin = userInfo.user.is_admin;
    const isWhitelisted = getSlowmode.whitelistedUsers?.includes(user) || false;
    const isExempt = isAdmin || isManager || isWhitelisted;
    if (isExempt) return;

    const userData = await prisma.SlowUsers.findFirst({
        where: {
            channel: channel,
            threadTs: getSlowmode.threadTs,
            user: user,
        },
    });

    const now = Date.now();

    if (!userData) {
        await prisma.SlowUsers.create({
            data: {
                channel: channel,
                threadTs: getSlowmode.threadTs,
                user: user,
                count: Math.floor(now / 1000),
            }
        });
        return;
    }

    const timeSinceLastMessage = (Math.floor(now / 1000) - userData.count);

    if (timeSinceLastMessage < getSlowmode.time) {
        const timeRemaining = Math.ceil(getSlowmode.time - timeSinceLastMessage);
        try {
            await client.chat.delete({
                channel: channel,
                ts: ts,
                token: process.env.SLACK_USER_TOKEN
            });
        } catch(e) {
            console.error(`An error occured: ${e}`);
        }

        await client.chat.postEphemeral({
            channel: channel,
            user: user,
            thread_ts: thread_ts,
            text: `Slowmode active: you can send another message in ${timeRemaining} seconds.\n\nYour message was:\n${text}`
        });
    } else {
        await prisma.SlowUsers.upsert({
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
                count: Math.floor(now / 1000)
            },
            update: {
                count: Math.floor(now / 1000),
            }
        });
    }
}

module.exports = startSlowMode;