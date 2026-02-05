import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    isUserAdmin,
    deleteMessage,
    postEphemeral,
    removeReaction,
    logBoth,
    getThreadLink,
    client,
} from '../../utils/index.js';

const prisma = getPrisma();

async function messageListener({
    payload: message,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!message || !('user' in message) || !message.user) return;

    const thread_ts = 'thread_ts' in message ? message.thread_ts : undefined;
    if (!thread_ts) return;

    const thread = await prisma.thread.findFirst({
        where: {
            id: thread_ts,
        },
    });

    if (!thread || !thread.time) return;

    if (thread.active && thread.time > new Date()) {
        const [, isAdmin] = await Promise.all([
            client.conversations
                .join({
                    channel: message.channel,
                })
                .catch(() => {}),
            isUserAdmin(message.user),
        ]);

        if (!isAdmin) {
            await Promise.all([
                deleteMessage(message.channel, message.ts),
                postEphemeral(
                    message.channel,
                    message.user,
                    `This thread is locked until ${thread.time.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'long' })} EST.${message.text ? `\n\nYour message was:\n${message.text}` : ''}`,
                    thread_ts
                ),
            ]);
        }
    } else if (thread.active && thread.time < new Date()) {
        await prisma.thread.update({
            where: {
                id: thread_ts,
            },
            data: {
                active: false,
            },
        });

        await Promise.all([
            ...(thread.channel
                ? [
                      logBoth(
                          `A thread in <#${message.channel}> was automatically unlocked.\nLink: ${getThreadLink(thread.channel, thread.id)}`
                      ),
                  ]
                : []),
            removeReaction(message.channel, 'lock', thread_ts),
        ]);
    }
}

export { messageListener };
