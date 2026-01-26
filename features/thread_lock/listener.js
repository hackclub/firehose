const {
    getPrisma,
    isUserAdmin,
    deleteMessage,
    postEphemeral,
    removeReaction,
    logBoth,
    getThreadLink,
} = require('../../utils');
const { client } = require('../../client');

const prisma = getPrisma();

/** @param {import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs} args */
async function messageListener(args) {
    const { payload: message } = args;
    if (!message || !('user' in message) || !message.user) return;

    const thread_ts = 'thread_ts' in message ? message.thread_ts : undefined;
    if (!thread_ts) return;

    const thread = await prisma.thread.findFirst({
        where: {
            id: thread_ts,
        },
    });

    if (!thread || !thread.time) return;

    try {
        if (thread.active && thread.time > new Date()) {
            try {
                await client.conversations.join({
                    channel: message.channel,
                });
            } catch (e) {}

            const isAdmin = await isUserAdmin(message.user);
            if (!isAdmin) {
                await postEphemeral(
                    message.channel,
                    message.user,
                    `Sorry, the thread is currently locked until ${thread.time.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'long' })} EST. For reference, your message was: \`${message.text}\``,
                    thread_ts
                );

                await deleteMessage(message.channel, message.ts);
            }
        } else if (thread.active && thread.time < new Date()) {
            if (thread.channel) {
                await logBoth(
                    `🔓 Thread unlocked in <#${message.channel}>
Reason: Autounlock (triggered by message)
Admin: System
Link: ${getThreadLink(thread.channel, thread.id)}`
                );
            }

            await prisma.thread.update({
                where: {
                    id: thread_ts,
                },
                data: {
                    active: false,
                },
            });

            await removeReaction(message.channel, 'lock', thread_ts);
        }
    } catch (e) {
        console.error(e);
    }
}

module.exports = { messageListener };
