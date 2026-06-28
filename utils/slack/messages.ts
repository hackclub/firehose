import { client, userClient } from './client.js';
import { runWithConcurrency } from '../helpers.js';
import type { ChatPostMessageResponse } from '@slack/web-api';

export async function deleteMessage(channel: string, ts: string): Promise<void> {
    await userClient.chat.delete({
        channel,
        ts,
    });
}

export async function deleteMessages(
    channel: string,
    timestamps: string[],
    concurrency = 1 // we could increase this to go faster, but we don't want to hit rate limits
): Promise<number> {
    let successCount = 0;
    await runWithConcurrency(timestamps, concurrency, async (ts) => {
        try {
            await deleteMessage(channel, ts);
            successCount++;
        } catch (e) {
            console.error(`Failed to delete message ${ts}:`, e);
        }
    });
    return successCount;
}

export async function destroyThread(channel: string, threadTs: string): Promise<void> {
    let toDelete: string[] = [];
    let cursor: string | undefined;

    do {
        const res = await client.conversations.replies({ channel, ts: threadTs, limit: 999, cursor });
        for (const msg of res.messages ?? []) {
            if (msg.ts) toDelete.push(msg.ts);
        }
        cursor = res.response_metadata?.next_cursor;
    } while (cursor);

    while (toDelete.length > 0) {
        const deleted = await deleteMessages(channel, toDelete);
        if (deleted === 0) break;

        try {
            const res = await client.conversations.replies({ channel, ts: threadTs, limit: 999 });
            toDelete = (res.messages ?? []).map((m) => m.ts).filter(Boolean) as string[];
        } catch (e: any) {
            if (e?.data?.error === 'thread_not_found') break;
            throw e;
        }
    }
}

export async function postEphemeral(
    channel: string,
    user: string,
    text: string,
    thread_ts?: string
): Promise<void> {
    await client.chat.postEphemeral({
        channel,
        user,
        text,
        ...(thread_ts && { thread_ts }),
    });
}

export async function postMessage(
    channel: string,
    text: string,
    thread_ts?: string
): Promise<ChatPostMessageResponse> {
    return await client.chat.postMessage({
        channel,
        text,
        ...(thread_ts && { thread_ts }),
    });
}

export async function addReaction(channel: string, name: string, timestamp: string): Promise<void> {
    try {
        await client.reactions.add({
            channel,
            name,
            timestamp,
        });
    } catch (e) {
        // Reaction may already exist
    }
}

export async function removeReaction(
    channel: string,
    name: string,
    timestamp: string
): Promise<void> {
    try {
        await client.reactions.remove({
            channel,
            name,
            timestamp,
        });
    } catch (e) {
        // Reaction may not exist
    }
}
