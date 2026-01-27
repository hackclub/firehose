import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    isUserAdmin,
    postMessage,
    postEphemeral,
    logInternal,
} from '../../utils/index.js';

async function unbanCommand({
    payload: { user_id, text, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
        await postEphemeral(channel_id, user_id, 'Only admins can run this command.');
        return;
    }

    const commands = text.split(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    let channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];

    if (!userToBan || !channel) {
        await postEphemeral(channel_id, user_id, 'Invalid arguments');
        return;
    }

    await prisma.user.deleteMany({
        where: { user: userToBan, channel: channel },
    });

    await Promise.all([
        postMessage(userToBan, `You were unbanned from <#${channel}>`),
        logInternal(`<@${userToBan}> was unbanned from <#${channel}>`),
    ]);
}

export default unbanCommand;
