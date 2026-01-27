import type { AllMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { isUserAdmin, deleteMessages, logInternal } from '../../utils/index.js';

async function purgeCommand({
    payload: { user_id, text, channel_id },
    client,
    respond,
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();
    const commands = text.split(' ');
    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
        await respond(`:x: Only admins can run this command.`);
        return;
    }
    if (!commands[0]) {
        await respond(`:x: You need to specify a number of messages to purge. :P`);
        return;
    }
    let amount = parseInt(commands[0]);
    if (isNaN(amount)) {
        await respond(`:x: You need to specify a valid number of messages to purge.`);
        return;
    }
    if (amount < 1) {
        await respond(`:x: You need to specify a valid number of messages to purge. (must be above 0)`);
        return;
    }

    const stamp = Date.now();
    const purgeMessage = await client.chat.postMessage({
        text: `:spin-loading: Purging \`${amount}\` messages`,
        channel: channel_id,
    });

    const messagesToDelete: string[] = [];
    let cursor: string | undefined;
    while (messagesToDelete.length < amount) {
        const response = await client.conversations.history({
            channel: channel_id,
            limit: Math.min(500, amount - messagesToDelete.length + 1),
            cursor,
        });
        for (const msg of response.messages ?? []) {
            if (!msg.ts || msg.ts === purgeMessage.ts) continue;
            messagesToDelete.push(msg.ts);
            if (messagesToDelete.length >= amount) break;
        }
        cursor = response.response_metadata?.next_cursor;
        if (!cursor) break;
    }

    const deleted = await deleteMessages(channel_id, messagesToDelete);
    const failed = messagesToDelete.length - deleted;

    if (!purgeMessage.ts) return;
    const elapsed = Math.floor((Date.now() - stamp) / 1000);
    await Promise.all([
        client.chat.update({
            channel: channel_id,
            ts: purgeMessage.ts,
            text: `:white_check_mark: Purged \`${deleted}/${messagesToDelete.length}\` messages${failed ? ` (${failed} failed)` : ''} in \`${elapsed}s\``,
        }),
        logInternal(
            `<@${user_id}> purged \`${deleted}/${messagesToDelete.length}\` messages${failed ? ` (${failed} failed)` : ''} in \`${elapsed}s\``
        ),
    ]);
}

export default purgeCommand;
