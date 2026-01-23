const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function unban(args) {
    const { payload, client } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();
    const commands = text.split(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    let channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    const getUser = await prisma.user.deleteMany({ where: { user: userToBan, channel: channel } });

    if (!userToBan || !channel) {
        return await client.chat.postEphemeral({
            channel: `${channel_id}`,
            user: `${user_id}`,
            text: 'Invalid arguments',
        });
    }

    await prisma.user.deleteMany({
        where: { user: userToBan, channel: channel },
    });
    await client.chat.postMessage({
        channel: userToBan,
        text: `You were unbanned from <#${channel}>`,
    });
    await client.chat.postMessage({
        channel: env.MIRRORCHANNEL,
        text: `<@${userToBan}> was unbanned from <#${channel}>`,
        mrkdwn: true,
    });
}

module.exports = unban;
