const { getPrisma, isUserAdmin, postMessage, postEphemeral, logInternal } = require('../../utils');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function channelBanCommand(args) {
    const { payload } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    const commands = text.split(' ');
    const reason = commands.slice(2).join(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    console.log(text, commands, userToBan, channel, reason);

    const errors = [];
    if (!isAdmin) errors.push('Only admins can run this command.');
    if (!reason) errors.push('A reason is required.');
    if (!userToBan) errors.push('A user is required');
    if (!channel) errors.push('A channel is required');

    if (errors.length > 0 || !userToBan || !channel)
        return await postEphemeral(channel_id, user_id, errors.join('\n'));

    try {
        await logInternal(`<@${user_id}> banned <@${userToBan}> from <#${channel}> for ${reason}`);

        await prisma.user.create({
            data: {
                admin: user_id,
                reason: reason,
                user: userToBan,
                channel: channel,
            },
        });

        await postMessage(
            userToBan,
            `You've been banned from <#${channel}>. A Fire Dept (community moderator) will reach out to you shortly with the reason`
        );

        await postEphemeral(
            channel_id,
            user_id,
            `<@${userToBan}> has been banned from <#${channel}> for ${reason}`
        );
    } catch (e) {
        await postEphemeral(channel_id, user_id, `An error occured: ${e}`);
    }
}

module.exports = channelBanCommand;
