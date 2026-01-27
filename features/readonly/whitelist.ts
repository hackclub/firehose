import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    getChannelManagers,
    isUserAdmin,
    postEphemeral,
    logInternal,
    PrismaClientKnownRequestError,
} from '../../utils/index.js';

async function whitelistCommand({
    payload: { text, channel_id, user_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();
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

        await Promise.all([
            postEphemeral(
                channel_id,
                user_id,
                `<@${userToAdd}> has been added to the whitelist for <#${channel}>`
            ),
            logInternal(`<@${user_id}> added <@${userToAdd}> to the whitelist for <#${channel}>`),
        ]);
    } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
            await postEphemeral(
                channel_id,
                user_id,
                `<#${channel}> is not configured as read-only. Use /readonly to make it read-only first.`
            );
            return;
        }
        throw e;
    }
}

export default whitelistCommand;
