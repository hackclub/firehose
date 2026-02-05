import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    getChannelManagers,
    isUserAdmin,
    postEphemeral,
    logInternal,
} from '../../utils/index.js';

async function readOnlyCommand({
    payload: { text, channel_id, user_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();
    const prisma = getPrisma();
    const commands = text.split(' ');
    const channel = commands[0].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    const isAdmin = await isUserAdmin(user_id);
    const channelManagers = await getChannelManagers(channel_id);

    const errors: string[] = [];
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
            await Promise.all([
                logInternal(`<@${user_id}> made <#${channel}> read-only.`),
                postEphemeral(channel, user_id, `<#${channel}> is now read-only.`),
            ]);
        } else {
            await prisma.channel.delete({
                where: {
                    id: channel,
                },
            });
            await Promise.all([
                logInternal(`<@${user_id}> disabled read-only mode in <#${channel}>.`),
                postEphemeral(channel, user_id, `<#${channel}> is no longer read-only.`),
            ]);
        }
    } catch (e) {
        console.log(e);
    }
}

export default readOnlyCommand;
