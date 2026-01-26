const { getPrisma, postMessage, postEphemeral, logInternal } = require('../../utils');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function unbanCommand(args) {
    const { payload } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();
    const commands = text.split(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    let channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];

    if (!userToBan || !channel) {
        return await postEphemeral(channel_id, user_id, 'Invalid arguments');
    }

    await prisma.user.deleteMany({
        where: { user: userToBan, channel: channel },
    });
    await postMessage(userToBan, `You were unbanned from <#${channel}>`);
    await logInternal(`<@${userToBan}> was unbanned from <#${channel}>`);
}

module.exports = unbanCommand;
