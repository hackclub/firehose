import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { logInternal, postEphemeral, getMessageLink } from '../../utils/index.js';
import { getPrisma } from '../../utils/prismaConnector.js';

const bannedPatterns: Array<{ word: string; regex: RegExp }> = process.env.BANNED_WORDS
    ? process.env.BANNED_WORDS.split(',').map((w) => {
          const word = w.trim().toLowerCase();
          const pattern = `(^|[^A-Za-z0-9])${RegExp.escape(word)}([^A-Za-z0-9]|$)`;
          return { word, regex: new RegExp(pattern, 'i') };
      })
    : [];

function findMatch(text: string): string | undefined {
    for (const { word, regex } of bannedPatterns) {
        if (regex.test(text)) return word;
    }

    return undefined;
}

export default async function messageMatchListener({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs): Promise<void> {
    if (bannedPatterns.length === 0) return;

    if (!payload || payload.type !== 'message' || !('user' in payload) || !payload.user) {
        return;
    }

    if (payload.subtype && payload.subtype !== 'thread_broadcast') {
        return;
    }

    const messageText = payload.text ?? '';
    const matchedWord = messageText ? findMatch(messageText) : undefined;
    if (!matchedWord) return;

    // await postEphemeral(
    //     payload.channel,
    //     payload.user,
    //     'user warning here',
    //     'thread_ts' in payload ? payload.thread_ts : undefined
    // );

    const messageLink = getMessageLink(payload.channel, payload.ts, payload.thread_ts);

    const prisma = getPrisma();
    await prisma.flaggedMessage.create({
        data: {
            flaggedWord: matchedWord,
            user: payload.user,
            channel: payload.channel,
            messageText: messageText,
            messageTs: payload.ts,
            threadTs: payload.thread_ts,
        },
    });

    await logInternal(
        `Word "${matchedWord}" flagged in <#${payload.channel}> from <@${payload.user}>: ${messageText}\n<${messageLink}|View Message>`
    );
}
