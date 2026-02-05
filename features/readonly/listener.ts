import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin, deleteMessage, postEphemeral } from '../../utils/index.js';

const READ_ONLY_MESSAGE = `This channel is read-only. If you are replying to a specific message, please reply in a thread.

Your message was:
`;

async function cleanupChannel({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!payload || payload.type !== 'message' || !('user' in payload)) return;

    const { user, ts, channel, subtype } = payload;
    const text = 'text' in payload ? payload.text : '';
    const threadTs = 'thread_ts' in payload ? payload.thread_ts : null;

    if (!user) return;

    const prisma = getPrisma();

    const [isAdmin, channelConfig] = await Promise.all([
        isUserAdmin(user),
        prisma.channel.findFirst({
            where: { id: channel, readOnly: true },
        }),
    ]);

    if (isAdmin) return;

    if (!channelConfig) return;
    const isAllowlisted = channelConfig.allowlist?.includes(user);
    if (isAllowlisted) return;

    if (threadTs && subtype !== 'thread_broadcast') return;

    await Promise.all([
        deleteMessage(channel, ts),
        postEphemeral(channel, user, READ_ONLY_MESSAGE + text),
    ]);
}

export default cleanupChannel;
