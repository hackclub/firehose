import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    isUserAdmin,
    postMessage,
    postEphemeral,
    logInternal,
} from '../../utils/index.js';

async function channelBanCommand({
    payload: { user_id, text, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    const commands = text.split(' ');
    const reason = commands.slice(2).join(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];

    const errors: string[] = [];
    if (!isAdmin) errors.push('Only admins can run this command.');
    if (!reason) errors.push('A reason is required.');
    if (!userToBan) errors.push('A user is required');
    if (!channel) errors.push('A channel is required');

    if (errors.length > 0 || !userToBan || !channel)
        return await postEphemeral(channel_id, user_id, errors.join('\n'));

    try {
        await prisma.user.create({
            data: {
                admin: user_id,
                reason: reason,
                user: userToBan,
                channel: channel,
            },
        });

        await Promise.all([
            postEphemeral(
                channel_id,
                user_id,
                `Banned <@${userToBan}> from <#${channel}> for ${reason}.`
            ),
            postMessage(
                userToBan,
                `You have been banned from <#${channel}>. A Fire Department member will reach out to you shortly with the reason.`
            ),
            logInternal(`<@${user_id}> banned <@${userToBan}> from <#${channel}> for ${reason}.`),
        ]);
    } catch (e) {
        await postEphemeral(channel_id, user_id, `An error occured: ${e}`);
    }
}

export default channelBanCommand;
