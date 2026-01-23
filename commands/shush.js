const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function shushBan(args) {
    const { payload, client } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();

    const userInfo = await client.users.info({ user: user_id });
    const isAdmin = userInfo.user?.is_admin;
    const commands = text.split(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const reason = commands.slice(1).join(' ');

    // // const userProfile = await client.users.profile.get({ user: userToBan });
    // const profilePhoto = userProfile.profile.image_512;
    // const displayName = userProfile.profile.display_name;

    const errors = [];
    if (!isAdmin) errors.push('Non-admins can only shush themselves.');
    if (!reason) errors.push('A reason is required.');
    if (!userToBan) errors.push('A user is required');

    if (errors.length > 0 || !userToBan)
        return await client.chat.postEphemeral({
            channel: channel_id,
            user: `${user_id}`,
            text: errors.join('\n'),
        });

    try {
        if (isAdmin) {
            await client.chat.postMessage({
                channel: env.MIRRORCHANNEL,
                text: `<@${user_id}> shushed <@${userToBan}> from all Slack channels. ${reason ? `for ${reason}` : ''}`,
            });
        }

        await prisma.bans.create({
            data: {
                admin: user_id,
                reason: reason,
                user: userToBan,

                // profile_photo: profilePhoto,
                // display_name: displayName,
            },
        });

        if (isAdmin) {
            await client.chat.postMessage({
                channel: userToBan,
                text: "You've been banned from talking in all Slack channels for a short period of time. A FD member will reach out to you shortly.",
            });
        }

        if (isAdmin) {
            await client.chat.postEphemeral({
                channel: channel_id,
                user: user_id,
                text: `You've been banned from talking in all Slack channels.`,
            });
        } else {
            await client.chat.postEphemeral({
                channel: channel_id,
                user: user_id,
                text: `<@${userToBan}> has been shushed from all channels for ${reason}`,
            });
        }
    } catch (e) {
        await client.chat.postEphemeral({
            channel: channel_id,
            user: user_id,
            text: `An error occured: ${e}`,
        });
    }
}

module.exports = shushBan;
