import type { App } from '@slack/bolt';

import { isUserAdmin, postEphemeral, getThreadLink } from '../../utils/index.js';

function registerShortcuts(app: App) {
    app.shortcut('destroy_thread', async ({ ack, body, client }) => {
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

        if (!isAdmin) {
            await postEphemeral(
                channel.id,
                user.id,
                '❌ Only admins can destroy threads.',
                thread_ts
            );
            return;
        }

        await client.views.open({
            trigger_id: trigger_id,
            view: {
                type: 'modal',
                callback_id: 'destroy_thread_modal',
                private_metadata: JSON.stringify({
                    thread_ts,
                    channel_id: channel.id,
                    message_ts: message.ts,
                }),
                title: {
                    type: 'plain_text',
                    text: 'Destroy Thread',
                    emoji: true,
                },
                submit: {
                    type: 'plain_text',
                    text: 'DESTROY!',
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
                            text: ':warning: *You are about to permanently delete this thread.*\n\nAre you sure you want to do this? *There is no going back. You cannot undo this.*',
                        },
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Thread: ${getThreadLink(channel.id, thread_ts || message.ts)}`,
                            },
                        ],
                    },
                ],
            },
        });
    });
}

export default registerShortcuts;
