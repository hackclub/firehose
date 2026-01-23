// const chrono = require('chrono-node');
const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function channelBan(args) {
    const { payload, client } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();

    const userInfo = await client.users.info({ user: user_id });
    const isAdmin = userInfo.user?.is_admin;
    const commands = text.split(' ');
    const reason = commands.slice(2).join(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    console.log(text, commands, userToBan, channel, reason);
    //TODO: Add temporary channel banning
    // const time = chrono.parse(`${commands[3]}`);

    // const userProfile = await client.users.profile.get({ user: userToBan });
    // const profilePhoto = userProfile.profile.image_512;
    // const displayName = userProfile.profile.display_name;

    const errors = [];
    if (!isAdmin) errors.push('Only admins can run this command.');
    if (!reason) errors.push('A reason is required.');
    if (!userToBan) errors.push('A user is required');
    if (!channel) errors.push('A channel is required');

    if (errors.length > 0 || !userToBan || !channel)
        return await client.chat.postEphemeral({
            channel: `${channel_id}`,
            user: `${user_id}`,
            text: errors.join('\n'),
        });

    try {
        await client.chat.postMessage({
            channel: env.MIRRORCHANNEL,
            text: `<@${user_id}> banned <@${userToBan}> from <#${channel}> for ${reason}`,
        });

        await prisma.user.create({
            data: {
                admin: user_id,
                reason: reason,
                user: userToBan,
                channel: channel,
            },
        });

        await client.chat.postMessage({
            channel: userToBan,
            text: `You've been banned from <#${channel}>. A Fire Dept (community moderator) will reach out to you shortly with the reason`,
        });

        await client.chat.postEphemeral({
            channel: channel_id,
            user: user_id,
            text: `<@${userToBan}> has been banned from <#${channel}> for ${reason}`,
        });
    } catch (e) {
        await client.chat.postEphemeral({
            channel: channel_id,
            user: user_id,
            text: `An error occured: ${e}`,
        });
    }
}

module.exports = channelBan;
