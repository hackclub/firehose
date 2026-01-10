const { getPrisma } = require("../utils/prismaConnector")
const getChannelManagers = require("../utils/isChannelManger");
require("dotenv").config();


async function startSlowMode(args) {
    const { client, payload } = args
    const { user, ts, text, channel, subtype } = payload

    if (subtype) return;

    const prisma = getPrisma();

    const getSlowmode = await prisma.Slowmode.findFirst({
        where: {
            channel: channel,
            locked: true
        }
    });

    if (!getSlowmode) return;

    const userInfo = await client.users.info({ user: user });
    const isManager = (await getChannelManagers(channel)).includes(user);
    const isAdmin = userInfo.user.is_admin;
    const isExempt = isAdmin || isManager;
    if (isExempt) return;

    const userData = await prisma.SlowUsers.findFirst({
        where: {
            channel: channel,
            user: user,
        },
    });

    const now = Date.now();

    if (!userData) {
        await prisma.SlowUsers.create({
            data: {
                channel: channel,
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
            text: `Slowmode active: you can send another message in ${timeRemaining} seconds.\n\nYour message was:\n ${text}`
        });
    } else {
        await prisma.SlowUsers.upsert({
            where: {
                channel_user: {
                    channel: channel,
                    user: user,
                },
            },
            create: {
                channel: channel,
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