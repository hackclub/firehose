import type { App } from '@slack/bolt';
import {
    deleteMessages,
    getThreadLink,
    env,
    isUserAPIAvailable,
    hideThread,
    client,
} from '../../utils/index.js';

function registerModal(app: App) {
    app.view('destroy_thread_modal', async ({ view, ack, body }) => {
        ack();

        const { thread_ts, channel_id, message_ts } = JSON.parse(view.private_metadata) as {
            thread_ts: string | undefined;
            channel_id: string;
            message_ts: string;
        };

        const parentTs = thread_ts || message_ts;

        const messageLog: {
            ts?: string;
            user?: string;
            text?: string;
        }[] = [];
        let deletionMethod: 'user_api' | 'manual' | 'user_api_failed' = 'manual';

        // Grab all messages currently in the thread for backup
        let cursor: string | undefined;
        do {
            const messagesResponse = await client.conversations.replies({
                channel: channel_id,
                ts: parentTs,
                limit: 999,
                cursor,
            });
            const messages = messagesResponse.messages ?? [];
            for (const msg of messages) {
                if (!msg.ts) continue;
                if (messageLog.some((m) => m.ts === msg.ts)) continue;
                messageLog.push(msg);
            }
            cursor = messagesResponse.response_metadata?.next_cursor;
        } while (cursor);

        // Try hideThread via moderation API if available
        if (isUserAPIAvailable) {
            try {
                await hideThread(channel_id, parentTs);
                deletionMethod = 'user_api';
            } catch {
                deletionMethod = 'user_api_failed';
            }
        }

        // Fall back to manual deletion if user API unavailable or failed
        if (deletionMethod !== 'user_api') {
            // Use already-collected messages for first pass
            let messagesToDelete = messageLog.map((msg) => msg.ts).filter(Boolean) as string[];

            while (messagesToDelete.length > 0) {
                const deleted = await deleteMessages(channel_id, messagesToDelete);
                if (deleted === 0) break;

                // Re-fetch to catch any new messages posted during deletion
                let messages;
                try {
                    const messagesResponse = await client.conversations.replies({
                        channel: channel_id,
                        ts: parentTs,
                        limit: 999,
                    });
                    messages = messagesResponse.messages ?? [];
                } catch (e: any) {
                    if (e?.data?.error === 'thread_not_found') break;
                    throw e;
                }

                // Capture any new messages for backup
                for (const msg of messages) {
                    if (!msg.ts) continue;
                    if (messageLog.some((m) => m.ts === msg.ts)) continue;
                    messageLog.push(msg);
                }

                messagesToDelete = messages.map((msg) => msg.ts).filter(Boolean) as string[];
            }
        }

        const totalMessages = messageLog.length;
        const logContent = messageLog
            .sort((a, b) => parseFloat(a.ts || '0') - parseFloat(b.ts || '0'))
            .map((msg) => `${msg.user || '(unknown user)'}: ${msg.text || '(no text)'}`)
            .join('\n');
        const methodNote =
            deletionMethod === 'user_api'
                ? ''
                : deletionMethod === 'user_api_failed'
                  ? ' (user API failed, used manual deletion)'
                  : ' (user API unavailable, used manual deletion)';

        // Upload backup log after everything is done
        await client.files.uploadV2({
            channel_id: env.MIRRORCHANNEL,
            initial_comment: `<@${body.user.id}> destroyed a thread in <#${channel_id}> (${totalMessages} messages).${methodNote}
Link: ${getThreadLink(channel_id, parentTs)}`,
            content: logContent,
            filename: `thread_destroy_${channel_id}_${parentTs}.txt`,
            title: `Destroyed thread log (${totalMessages} messages)`,
        });
    });
}

export default registerModal;
