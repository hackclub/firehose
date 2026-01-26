const {
    getPrisma,
    getChannelManagers,
    isUserAdmin,
    postEphemeral,
    logInternal,
} = require('../../utils');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function whitelistCommand(args) {
    const { payload } = args;
    const { text, channel_id, user_id } = payload;
    const prisma = getPrisma();
    const commands = text.split(' ');
    const channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    const userToAdd = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const isAdmin = await isUserAdmin(user_id);
    const channelManagers = await getChannelManagers(channel_id);
    console.info(channelManagers);

    const errors = [];
    if (!isAdmin && !channelManagers.includes(user_id))
        errors.push('Only admins can run this command.');
    if (!channel) errors.push('You need to give a channel to make it read only');
    if (!userToAdd) errors.push('You need to give a user to make it read only');

    if (errors.length > 0) return await postEphemeral(channel_id, user_id, errors.join('\n'));

    const getChannel = await prisma.channel.findFirst({
        where: {
            id: channel,
            readOnly: true,
        },
    });

    console.log(getChannel);
    if (getChannel) {
        console.log('this is whitelisting');
        console.log('I am trying');
        try {
            await prisma.channel.update({
                where: {
                    id: channel,
                },
                data: {
                    allowlist: {
                        push: userToAdd,
                    },
                },
            });
        } catch (e) {
            console.log('Error:', e);
        }
        const finalResult = await prisma.channel.findFirst({
            where: {
                id: channel,
                readOnly: true,
            },
        });

        console.log('I did it');
        console.log(`Added ${userToAdd} to ${channel}:`, finalResult);

        try {
            await logInternal(
                `<@${user_id}> added <@${userToAdd}> to the whitelist for <#${channel}>`
            );
        } catch (e) {
            console.error(e);
        }
    }
}

module.exports = whitelistCommand;
