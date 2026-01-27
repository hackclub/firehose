import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin, deleteMessage, postEphemeral } from '../../utils/index.js';

const READ_ONLY_MESSAGE =
    "This channel is read-only! If you're replying to something, send a message in a thread.";

async function cleanupChannel({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!payload || payload.type !== 'message' || !('user' in payload)) return;

    const { user, ts, channel, subtype } = payload;
    const threadTs = 'thread_ts' in payload ? payload.thread_ts : null;
    const botId = 'bot_id' in payload ? payload.bot_id : null;

    if (!user) return;
    if (await isUserAdmin(user)) return;

    const prisma = getPrisma();
    const channelConfig = await prisma.channel.findFirst({
        where: { id: channel, readOnly: true },
    });

    if (!channelConfig) return;

    const isAllowlisted = channelConfig.allowlist?.includes(user);
    if (isAllowlisted) return;

    if (threadTs) {
        if (subtype === 'thread_broadcast') {
            await deleteMessage(channel, ts);
            if (!botId) {
                await postEphemeral(channel, user, READ_ONLY_MESSAGE);
            }
        }
        return;
    }

    try {
        await deleteMessage(channel, ts);
    } catch (e) {
        console.error('Error deleting message:', e);
    }
    await postEphemeral(channel, user, READ_ONLY_MESSAGE);
}

export default cleanupChannel;
