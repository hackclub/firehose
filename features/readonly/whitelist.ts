import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    getChannelManagers,
    isUserAdmin,
    postEphemeral,
    logInternal,
} from '../../utils/index.js';

async function whitelistCommand({
    payload: { text, channel_id, user_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();
    const commands = text.split(' ');

    if (commands.length < 2) {
        return await postEphemeral(channel_id, user_id, 'Usage: /whitelist @user #channel');
    }

    const channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    const userToAdd = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const isAdmin = await isUserAdmin(user_id);
    const channelManagers = await getChannelManagers(channel_id);

    const errors: string[] = [];
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

    if (getChannel) {
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
            console.error(e);
        }
        const finalResult = await prisma.channel.findFirst({
            where: {
                id: channel,
                readOnly: true,
            },
        });

        try {
            await logInternal(
                `<@${user_id}> added <@${userToAdd}> to the whitelist for <#${channel}>`
            );
        } catch (e) {
            console.error(e);
        }
    }
}

export default whitelistCommand;
