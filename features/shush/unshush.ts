import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    isUserAdmin,
    postMessage,
    postEphemeral,
    logInternal,
} from '../../utils/index.js';

async function unshushCommand({
    payload: { user_id, text, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();
    const commands = text.split(' ');
    const isAdmin = await isUserAdmin(user_id);
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];

    if (!isAdmin) {
        return await postEphemeral(channel_id, user_id, 'Only admins can run this command.');
    }
    if (!userToBan) {
        return await postEphemeral(channel_id, user_id, 'You need to specify a user to unshush.');
    }

    await logInternal(`<@${userToBan}> was unshushed`);

    await prisma.bans.deleteMany({
        where: { user: userToBan },
    });

    await postMessage(userToBan, `You were unshushed`);
}

export default unshushCommand;
