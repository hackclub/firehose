import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin, deleteMessage, postEphemeral } from '../../utils/index.js';

async function cleanupChannel({
    client,
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;
    const thread_ts = 'thread_ts' in payload ? payload.thread_ts : null;
    const bot_id = 'bot_id' in payload ? payload.bot_id : null;
    const prisma = getPrisma();

    if (!user) {
        console.warn('No user found in payload, skipping cleanupChannel.');
        return;
    }

    const isAdmin = await isUserAdmin(user);

    if (isAdmin) return;

    const getChannel = await prisma.channel.findFirst({
        where: {
            id: channel,
            readOnly: true,
        },
    });

    const allowlist = await prisma.channel.findFirst({
        where: {
            id: channel,
            allowlist: {
                has: user,
            },
        },
    });

    if (!getChannel) return;

    if (thread_ts) {
        try {
            const threadMessage = await client.conversations.replies({
                channel: channel,
                ts: thread_ts,
            });

            const isThreadBroadcast = subtype === 'thread_broadcast';
            if (isThreadBroadcast) {
                await deleteMessage(channel, ts);

                if (!bot_id) {
                    await postEphemeral(
                        channel,
                        user,
                        "This channel is read-only! If you're replying to something, send a message in a thread."
                    );
                }
            }
        } catch (e) {
            console.error('Error fetching thread messages:', e);
        }
        return;
    }

    if (allowlist) {
        return;
    }
    if (text) {
        try {
            await deleteMessage(channel, ts);
            console.log('Message deleted successfully');
        } catch (e) {
            console.error('Error deleting message:', e);
        }
        await postEphemeral(
            channel,
            user,
            "This channel is read-only! If you're replying to something, send a message in a thread."
        );
    }

    if (!subtype) {
        return;
    }

    if (subtype === 'file_share') {
        try {
            await deleteMessage(channel, ts);
            await postEphemeral(
                channel,
                user,
                "This channel is read-only! If you're replying to something, send a message in a thread."
            );
        } catch (e) {
            // Error deleting message
        }
    }
}

export default cleanupChannel;
