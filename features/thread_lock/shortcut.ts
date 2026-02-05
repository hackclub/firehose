import type { App } from '@slack/bolt';

import {
    getPrisma,
    isUserAdmin,
    postEphemeral,
    postMessage,
    removeReaction,
    logBoth,
    getThreadLink,
} from '../../utils/index.js';

function registerShortcuts(app: App) {
    const prisma = getPrisma();

    app.shortcut('lock_thread', async ({ ack, body, client }) => {
        ack();

        if (body.type !== 'message_action') return;
        const { channel, message, trigger_id, user } = body;

        const [, isAdmin] = await Promise.all([
            client.conversations
                .join({
                    channel: channel.id,
                })
                .catch(() => {}),
            isUserAdmin(user.id),
        ]);
        const thread_ts = message.thread_ts || message.ts;

        if (!thread_ts) {
            await postEphemeral(channel.id, user.id, '❌ This is not a thread');
            return;
        }
        if (!isAdmin) {
            await postEphemeral(
                channel.id,
                user.id,
                '❌ Only admins can run this command.',
                thread_ts
            );
            return;
        }

        const thread = await prisma.thread.findFirst({
            where: {
                id: thread_ts,
            },
        });

        if (!thread || !thread.active) {
            await client.views.open({
                trigger_id: trigger_id,
                view: {
                    type: 'modal',
                    callback_id: 'lock_modal',
                    private_metadata: JSON.stringify({
                        thread_id: thread_ts,
                        channel_id: channel.id,
                    }),
                    title: {
                        type: 'plain_text',
                        text: 'Lock the thread',
                        emoji: true,
                    },
                    submit: {
                        type: 'plain_text',
                        text: 'Submit',
                        emoji: true,
                    },
                    close: {
                        type: 'plain_text',
                        text: 'Cancel',
                        emoji: true,
                    },
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: 'Use this modal to lock the thread. Please note, this is logged.',
                            },
                        },
                        {
                            type: 'input',
                            element: {
                                type: 'plain_text_input',
                                action_id: 'plain_text_input-action',
                            },
                            label: {
                                type: 'plain_text',
                                text: 'Reason',
                                emoji: true,
                            },
                        },
                        {
                            type: 'input',
                            element: {
                                type: 'datetimepicker',
                                action_id: 'datetimepicker-action',
                            },
                            label: {
                                type: 'plain_text',
                                text: 'Expires',
                                emoji: true,
                            },
                        },
                    ],
                },
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

            await Promise.all([
                logBoth(
                    `<@${user.id}> unlocked a thread in <#${channel.id}>.\nLink: ${getThreadLink(channel.id, thread_ts)}`
                ),
                removeReaction(channel.id, 'lock', thread_ts),
            ]);
        }
    });

    app.shortcut('lock_thread_forever', async ({ ack, body, client }) => {
        ack();

        if (body.type !== 'message_action') return;
        const { channel, message, user } = body;

        const isAdmin = await isUserAdmin(user.id);
        const thread_ts = message.thread_ts || message.ts;

        if (!thread_ts) {
            await postEphemeral(channel.id, user.id, '❌ This is not a thread');
            return;
        }
        if (!isAdmin) {
            await postEphemeral(
                channel.id,
                user.id,
                '❌ Only admins can run this command.',
                thread_ts
            );
            return;
        }

        await Promise.all([
            prisma.log.create({
                data: {
                    thread_id: thread_ts,
                    admin: user.id,
                    lock_type: 'lock',
                    time: new Date('9999-01-01T00:00:00.000Z'),
                    reason: '(none)',
                    channel: channel.id,
                    active: true,
                },
            }),
            prisma.thread.upsert({
                where: {
                    id: thread_ts,
                },
                create: {
                    id: thread_ts,
                    admin: user.id,
                    lock_type: 'forever',
                    time: new Date('9999-01-01T00:00:00.000Z'),
                    reason: '(none)',
                    channel: channel.id,
                    active: true,
                },
                update: {
                    admin: user.id,
                    lock_type: 'forever',
                    time: new Date('9999-01-01T00:00:00.000Z'),
                    reason: '(none)',
                    channel: channel.id,
                    active: true,
                },
            }),
        ]);

        await Promise.all([
            postMessage(channel.id, `This thread is locked indefinitely.`, thread_ts),
            logBoth(
                `<@${user.id}> locked a thread in <#${channel.id}> indefinitely.\nLink: ${getThreadLink(channel.id, thread_ts)}`
            ),
            removeReaction(channel.id, 'lock', thread_ts),
        ]);
    });
}

export default registerShortcuts;
