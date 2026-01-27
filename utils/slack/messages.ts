import { client, userClient } from '../../client.js';
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
    concurrency = 3
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
