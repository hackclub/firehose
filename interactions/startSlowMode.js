const { getPrisma } = require('../utils/prismaConnector');
require('dotenv').config();

/** @param {import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs} args */
async function startSlowMode(args) {
    const { client, payload } = args;
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;
    if (!user) return;
    const prisma = getPrisma();

    const getSlowmode = await prisma.slowmode.findFirst({
        where: {
            channel: channel,
        },
    });
    if (!getSlowmode) return;

    await client.chat.postMessage({
        channel: channel,
        text: 'Slow mode is in progress!',
    });

    const createUser = await prisma.slowUsers.upsert({
        where: {
            channel_user: {
                // Use the composite unique constraint
                channel: channel,
                user: user,
            },
        },
        create: {
            channel: channel,
            user: user,
            count: 0,
        },
        update: {
            count: { increment: 1 },
        },
    });

    const userData = await prisma.slowUsers.findFirst({
        where: {
            channel: channel,
            user: user,
        },
    });

    console.log(userData);
    await client.chat.postMessage({
        channel: channel,
        text: 'test',
    });
}

module.exports = startSlowMode;
