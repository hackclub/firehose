import { isUserAPIAvailable, userAPI } from './userAPI.js';
import { client, userClient } from './client.js';

export async function lockThread(channel: string, ts: string): Promise<void> {
    await userAPI('moderation.locks.create', {
        channel_id: channel,
        thread_ts: ts,
    });
}

export async function unlockThread(channel: string, ts: string): Promise<void> {
    await userAPI('moderation.locks.remove', {
        channel_id: channel,
        thread_ts: ts,
    });
}

export async function hideThread(channel: string, ts: string): Promise<void> {
    await userAPI('moderation.thread.hide', {
        channel_id: channel,
        thread_ts: ts,
    });
}

export async function lockMessage(channel: string, ts: string): Promise<void> {
    if (!isUserAPIAvailable) throw new Error('User API is not available');
    const tempReply = await client.chat.postMessage({
        channel,
        thread_ts: ts,
        text: '-',
    });
    let lockSucceeded = false;
    let error = null;
    try {
        await lockThread(channel, ts);
        lockSucceeded = true;
    } catch (e) {
        error = e;
    } finally {
        if (tempReply.ts) {
            if (lockSucceeded) {
                await userClient.chat.delete({ channel, ts: tempReply.ts });
            } else {
                await client.chat.delete({ channel, ts: tempReply.ts });
            }
        }
    }
    if (!lockSucceeded) {
        throw new Error('Locking the thread failed', { cause: error });
    }
}
