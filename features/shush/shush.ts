const { getPrisma, isUserAdmin, postMessage, postEphemeral, logInternal } = require('../../utils');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function shushCommand(args) {
    const { payload } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    const commands = text.split(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const reason = commands.slice(1).join(' ');

    const errors = [];
    if (!isAdmin) errors.push('Non-admins can only shush themselves.');
    if (!reason) errors.push('A reason is required.');
    if (!userToBan) errors.push('A user is required');

    if (errors.length > 0 || !userToBan)
        return await postEphemeral(channel_id, user_id, errors.join('\n'));

    try {
        if (isAdmin) {
            await logInternal(
                `<@${user_id}> shushed <@${userToBan}> from all Slack channels. ${reason ? `for ${reason}` : ''}`
            );
        }

        await prisma.bans.create({
            data: {
                admin: user_id,
                reason: reason,
                user: userToBan,
            },
        });

        if (isAdmin) {
            await postMessage(
                userToBan,
                "You've been banned from talking in all Slack channels for a short period of time. A FD member will reach out to you shortly."
            );
        }

        if (isAdmin) {
            await postEphemeral(
                channel_id,
                user_id,
                `You've been banned from talking in all Slack channels.`
            );
        } else {
            await postEphemeral(
                channel_id,
                user_id,
                `<@${userToBan}> has been shushed from all channels for ${reason}`
            );
        }
    } catch (e) {
        await postEphemeral(channel_id, user_id, `An error occured: ${e}`);
    }
}

module.exports = shushCommand;
