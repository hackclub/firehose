import { client, userClient } from '../../client.js';
import type { ChatPostMessageResponse } from '@slack/web-api';

export async function deleteMessage(channel: string, ts: string): Promise<void> {
    await userClient.chat.delete({
        channel,
        ts,
    });
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
