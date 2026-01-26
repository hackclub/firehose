import { env } from './env.js';
import { client } from '../client.js';

export async function logPublic(text: string, logConsole = true): Promise<void> {
    if (logConsole) {
        console.log(text);
    }
    if (env.SLACK_LOG_CHANNEL) {
        await client.chat.postMessage({
            channel: env.SLACK_LOG_CHANNEL,
            text,
        });
    }
}

export async function logInternal(text: string, logConsole = true): Promise<void> {
    if (logConsole) {
        console.log(text);
    }
    await client.chat.postMessage({
        channel: env.MIRRORCHANNEL,
        text,
    });
}

export async function logBoth(text: string, logConsole = true): Promise<void> {
    if (logConsole) {
        console.log(text);
    }
    await Promise.all([logPublic(text, false), logInternal(text, false)]);
}

export function getThreadLink(channel: string, ts: string): string {
    return `https://hackclub.slack.com/archives/${channel}/p${ts.toString().replace('.', '')}`;
}
