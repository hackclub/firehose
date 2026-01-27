import type { App } from '@slack/bolt';
import { client } from '../../client.js';
import { deleteMessages, logInternal, getThreadLink, env } from '../../utils/index.js';

function registerModal(app: App) {
    app.view('destroy_thread_modal', async ({ view, ack, body }) => {
        ack();

        const { thread_ts, channel_id, message_ts } = JSON.parse(view.private_metadata) as {
            thread_ts: string | undefined;
            channel_id: string;
            message_ts: string;
        };

        const parentTs = thread_ts || message_ts;

        const stamp = Date.now();
        const messageLog: string[] = [];
        let totalDeleted = 0;
        let totalFailed = 0;

        while (true) {
            let messages;
            try {
                const messagesResponse = await client.conversations.replies({
                    channel: channel_id,
                    ts: parentTs,
                    limit: 1000,
                });
                messages = messagesResponse.messages ?? [];
            } catch (e: any) {
                if (e?.data?.error === 'thread_not_found') break;
                throw e;
            }

            if (messages.length === 0) break;

            const messagesToDelete: string[] = [];

            for (const msg of messages) {
                if (!msg.ts) continue;
                messagesToDelete.push(msg.ts);
                messageLog.push(`${msg.user}: ${msg.text || '(no text)'}`);
            }

            if (messagesToDelete.length === 0) break;

            const deleted = await deleteMessages(channel_id, messagesToDelete);
            totalDeleted += deleted;
            totalFailed += messagesToDelete.length - deleted;

            if (deleted === 0) break;
        }

        const elapsed = Math.floor((Date.now() - stamp) / 1000);
        const logContent = messageLog.join('\n');

        await client.files.uploadV2({
            channel_id: env.MIRRORCHANNEL,
            initial_comment: `🗑️ Thread destroyed in <#${channel_id}>
Admin: <@${body.user.id}>
Messages: ${totalDeleted}${totalFailed ? ` (${totalFailed} failures)` : ''} in ${elapsed}s
Link: ${getThreadLink(channel_id, parentTs)}`,
            content: logContent,
            filename: `thread_destroy_${parentTs}.txt`,
            title: `Destroyed thread log (${totalDeleted} messages)`,
        });
    });
}

export default registerModal;
