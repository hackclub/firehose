const {
    getPrisma,
    getChannelManagers,
    isUserAdmin,
    postEphemeral,
    logInternal,
} = require('../../utils');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function readOnlyCommand(args) {
    const { payload } = args;
    const { text, channel_id, user_id } = payload;
    const prisma = getPrisma();
    const commands = text.split(' ');
    const channel = commands[0].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    const isAdmin = await isUserAdmin(user_id);
    const channelManagers = await getChannelManagers(channel_id);

    const errors = [];
    if (!isAdmin && !channelManagers.includes(user_id))
        errors.push('Only admins can run this command.');
    if (!channel) errors.push('You need to give a channel to make it read only');

    if (errors.length > 0 || !channel)
        return await postEphemeral(channel_id, user_id, errors.join('\n'));

    const isReadOnly = await prisma.channel.findFirst({
        where: {
            id: channel,
            readOnly: true,
        },
    });

    try {
        if (!isReadOnly) {
            await prisma.channel.create({
                data: {
                    id: channel,
                    readOnly: true,
                    allowlist: [`${user_id}`],
                },
            });
            await logInternal(`<#${channel}> was made read-only by <@${user_id}>`);
            await postEphemeral(channel, user_id, `<#${channel}> has been made read only`);
        } else {
            await prisma.channel.delete({
                where: {
                    id: channel,
                },
            });
            await logInternal(`<#${channel}> was made no longer read-only by <@${user_id}>`);
        }
    } catch (e) {
        console.log(e);
    }
}

module.exports = readOnlyCommand;
