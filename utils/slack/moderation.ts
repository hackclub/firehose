import { userAPI } from './userAPI.js';

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
