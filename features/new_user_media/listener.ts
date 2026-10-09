import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    isUserBot,
    isUserExempt,
    deleteFile,
    postEphemeral,
    logInternal,
    getMessageLink,
} from '../../utils/index.js';

const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

const EXCLUDED_CHANNELS = new Set([
    'C092833JXKK', // #identity-help
    'C07TM4C0AQ5', // #help
]);

async function newUserMediaListener({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (payload?.type !== 'message' || !('user' in payload)) return;

    const files = 'files' in payload ? payload.files : undefined;
    if (!files?.length) return;

    const { user, ts, channel } = payload;
    if (!user) return;
    if (EXCLUDED_CHANNELS.has(channel)) return;

    const prisma = getPrisma();
    const member = await prisma.memberJoinDate.findUnique({
        where: { userId: user },
    });
    if (!member?.joinedAt) return;
    if (Date.now() - member.joinedAt.getTime() >= NEW_USER_WINDOW_MS) return;

    if (await isUserBot(user)) return;
    if (await isUserExempt(user, channel)) return;

    const thread_ts = 'thread_ts' in payload ? payload.thread_ts : undefined;

    let deleted = 0;
    for (const file of files) {
        try {
            await deleteFile(channel, file.id);
            deleted++;
        } catch (e) {
            console.error(`Failed to delete file ${file.id}:`, e);
        }
    }
    if (deleted === 0) return;

    await Promise.all([
        postEphemeral(
            channel,
            user,
            "Your account is less than a day old, so you can't share files yet. Your upload was removed.",
            thread_ts
        ),
        logInternal(
            `Deleted ${deleted} file${deleted === 1 ? '' : 's'} from new account <@${user}> in <#${channel}>: ${getMessageLink(channel, ts, thread_ts)}`
        ),
    ]);
}

export default newUserMediaListener;
