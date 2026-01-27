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
    await ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
        return await postEphemeral(channel_id, user_id, 'Only admins can run this command.');
    }

    const commands = text.split(' ');
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    let channel = commands[1].match(/<#([A-Z0-9]+)\|?.*>/)?.[1];

    if (!userToBan || !channel) {
        return await postEphemeral(channel_id, user_id, 'Invalid arguments');
    }

    await prisma.user.deleteMany({
        where: { user: userToBan, channel: channel },
    });
    await postMessage(userToBan, `You were unbanned from <#${channel}>`);
    await logInternal(`<@${userToBan}> was unbanned from <#${channel}>`);
}

export default unbanCommand;
