// const { PrismaClient } = require('@prisma/client');
const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');
const getChannelManagers = require('../utils/isChannelManager');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function readOnly(args) {
    const { payload, client } = args;
    const { text, channel_id, user_id } = payload;
    const prisma = getPrisma();
    const commands = text.split(' ');
    const userInfo = await client.users.info({ user: user_id });
    const channel = commands[0].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    const isAdmin = userInfo.user?.is_admin;
    const channelManagers = await getChannelManagers(channel_id);

    const errors = [];
    if (!isAdmin && !channelManagers.includes(user_id))
        errors.push('Only admins can run this command.');
    if (!channel) errors.push('You need to give a channel to make it read only');

    if (errors.length > 0 || !channel)
        return await client.chat.postEphemeral({
            channel: `${channel_id}`,
            user: `${user_id}`,
            text: errors.join('\n'),
        });

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
            await client.chat.postMessage({
                channel: env.MIRRORCHANNEL,
                text: `<#${channel}> was made read-only by <@${user_id}>`,
            });
            await client.chat.postEphemeral({
                channel: channel,
                user: user_id,
                text: `<#${channel}> has been made read only`,
            });
        } else {
            await prisma.channel.delete({
                where: {
                    id: channel,
                },
            });
            await client.chat.postMessage({
                channel: env.MIRRORCHANNEL,
                text: `<#${channel}> was made no longer read-only by <@${user_id}>`,
            });
        }
    } catch (e) {
        console.log(e);
    }
}

module.exports = readOnly;
