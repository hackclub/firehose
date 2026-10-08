import { client, userClient } from './client.js';
import { runWithConcurrency } from '../helpers.js';
import { isUserAPIAvailable, userAPI } from './userAPI.js';
import type { ChatPostMessageResponse } from '@slack/web-api';

let userClientId: string | undefined;
async function getUserClientId(): Promise<string> {
  if (!userClientId) {
    const auth = await userClient.auth.test();
    if (!auth.user_id) throw new Error('Could not resolve userClient identity');
    userClientId = auth.user_id;
  }
  return userClientId;
}

export async function deleteMessage(channel: string, ts: string): Promise<void> {
  try {
    await userClient.chat.delete({ channel, ts });
  } catch (e: any) {
    if (e?.data?.error !== 'channel_not_found') throw e;

    const userId = await getUserClientId();
    try {
      await client.conversations.invite({ channel, users: userId });
    } catch (inviteErr: any) {
      if (inviteErr?.data?.error !== 'already_in_channel') throw inviteErr;
    }
    await userClient.chat.delete({ channel, ts });
  }
}

let browserUserId: string | undefined;
async function getBrowserUserId(): Promise<string> {
  if (!browserUserId) {
    const auth = await userAPI('auth.test', {});
    if (!auth.user_id) throw new Error('Could not resolve browser user identity');
    browserUserId = auth.user_id as string;
  }
  return browserUserId;
}

function isFileNotFound(e: any): boolean {
  return e?.data?.error === 'file_not_found' || String(e?.message).includes('file_not_found');
}

// the deleting account can't see files in channels it isn't in, so invite it and retry
async function deleteFileAs(
  channel: string,
  del: () => Promise<unknown>,
  getUserId: () => Promise<string>
): Promise<void> {
  try {
    await del();
  } catch (e) {
    if (!isFileNotFound(e)) throw e;

    const userId = await getUserId();
    try {
      await client.conversations.invite({ channel, users: userId });
    } catch (inviteErr: any) {
      if (inviteErr?.data?.error !== 'already_in_channel') throw inviteErr;
    }
    await del();
  }
}

// the bot can't delete other users' files, prefer the xoxp token
// fall back to the admin browser session if that fails
export async function deleteFile(channel: string, file: string): Promise<void> {
  try {
    await deleteFileAs(channel, () => userClient.files.delete({ file }), getUserClientId);
  } catch (e: any) {
    if (!isUserAPIAvailable) throw e;
    console.warn(
      `xoxp could not delete file ${file} (${e?.data?.error ?? e}), falling back to browser session`
    );
    await deleteFileAs(channel, () => userAPI('files.delete', { file }), getBrowserUserId);
  }
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
