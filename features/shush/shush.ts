import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    isUserAdmin,
    postMessage,
    postEphemeral,
    logInternal,
} from '../../utils/index.js';

async function shushCommand({
    payload: { user_id, text, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    const commands = text.split(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    const reason = commands.slice(1).join(' ');

    if (!isAdmin) {
        await postEphemeral(channel_id, user_id, "You don't have permission to use this command.");
        return;
    }

    const errors: string[] = [];
    if (!reason) errors.push('A reason is required.');
    if (!userToBan) errors.push('A user is required.');

    if (errors.length > 0 || !userToBan) {
        await postEphemeral(channel_id, user_id, errors.join('\n'));
        return;
    }

    await prisma.bans.create({
        data: {
            admin: user_id,
            reason: reason,
            user: userToBan,
        },
    });

    await Promise.all([
        postMessage(
            userToBan,
            "You've been banned from talking in all Slack channels for a short period of time. A FD member will reach out to you shortly."
        ),
        postEphemeral(
            channel_id,
            user_id,
            `<@${userToBan}> has been shushed from all channels for ${reason}`
        ),
        logInternal(
            `<@${user_id}> shushed <@${userToBan}> from all Slack channels. ${reason ? `for ${reason}` : ''}`
        ),
    ]);
}

export default shushCommand;
