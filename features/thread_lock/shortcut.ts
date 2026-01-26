const {
    getPrisma,
    isUserAdmin,
    postEphemeral,
    postMessage,
    removeReaction,
    logBoth,
    getThreadLink,
} = require('../../utils');

/**
 * @param {import('@slack/bolt').App} app
 */
function registerShortcuts(app) {
    const prisma = getPrisma();

    app.shortcut('lock_thread', async ({ ack, body, client }) => {
        await ack();

        if (body.type !== 'message_action') return;
        const { channel, message, trigger_id, user } = body;

        try {
            await client.conversations.join({
                channel: channel.id,
            });
        } catch (e) {}

        const isAdmin = await isUserAdmin(user.id);
        const thread_ts = message.thread_ts || message.ts;

        if (!thread_ts) {
            return await postEphemeral(channel.id, user.id, '❌ This is not a thread');
        }
        if (!isAdmin) {
            return await postEphemeral(
                channel.id,
                user.id,
                '❌ Only admins can run this command.',
                thread_ts
            );
        }

        const thread = await prisma.thread.findFirst({
            where: {
                id: thread_ts,
            },
        });

        if (!thread || !thread.active) {
            await client.views.open({
                trigger_id: trigger_id,
                view: /** @type {import('@slack/types').ModalView} */ ({
                    ...require('./modal.json'),
                    callback_id: 'lock_modal',
                    private_metadata: JSON.stringify({
                        thread_id: thread_ts,
                        channel_id: channel.id,
                    }),
                }),
            });
            return;
        } else {
            await prisma.thread.update({
                where: {
                    id: thread_ts,
                },
                data: {
                    active: false,
                },
            });

            await logBoth(
                `🔓 Thread unlocked in <#${channel.id}>
Reason: Admin clicked unlock.
Link: ${getThreadLink(channel.id, thread_ts)}`
            );

            try {
                await removeReaction(channel.id, 'lock', thread_ts);
            } catch (e) {}
        }
    });

    app.shortcut('lock_thread_forever', async ({ ack, body, client }) => {
        await ack();

        if (body.type !== 'message_action') return;
        const { channel, message, user } = body;

        const isAdmin = await isUserAdmin(user.id);
        const thread_ts = message.thread_ts || message.ts;

        if (!thread_ts) {
            return await postEphemeral(channel.id, user.id, '❌ This is not a thread');
        }
        if (!isAdmin) {
            return await postEphemeral(
                channel.id,
                user.id,
                '❌ Only admins can run this command.',
                thread_ts
            );
        }

        const thread = await prisma.thread.findFirst({
            where: {
                id: thread_ts,
            },
        });

        await prisma.log.create({
            data: {
                thread_id: thread_ts,
                admin: user.id,
                lock_type: 'lock',
                time: new Date('9999-01-01T00:00:00.000Z'),
                reason: '(none)',
                channel: channel.id,
                active: true,
            },
        });

        if (!thread) {
            await prisma.thread.create({
                data: {
                    id: thread_ts,
                    admin: user.id,
                    lock_type: 'forever',
                    time: new Date('9999-01-01T00:00:00.000Z'),
                    reason: '(none)',
                    channel: channel.id,
                    active: true,
                },
            });
        } else {
            await prisma.thread.update({
                where: {
                    id: thread_ts,
                },
                data: {
                    id: thread_ts,
                    admin: user.id,
                    lock_type: 'forever',
                    time: new Date('9999-01-01T00:00:00.000Z'),
                    reason: '(none)',
                    channel: channel.id,
                    active: true,
                },
            });
        }

        await postMessage(channel.id, `🔒 Thread locked indefinitely.`, thread_ts);

        await logBoth(
            `🔒 Thread locked in <#${channel.id}> indefinitely
Reason: (none)
Admin: ${user.id}
Link: ${getThreadLink(channel.id, thread_ts)}`
        );
    });
}

module.exports = registerShortcuts;
