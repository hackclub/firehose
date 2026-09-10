import { deleteMessages, logInternal, client, env } from '../../utils/index.js';
import { searchUserMessages } from './search.js';

export type NukeTarget = {
    channel: string;
    timestamps: string[];
};

export async function collectTargets(user: string, since: Date): Promise<NukeTarget[]> {
    const matches = await searchUserMessages(user, since);

    const byChannel = new Map<string, string[]>();
    for (const { channel, ts } of matches) {
        const existing = byChannel.get(channel);
        if (existing) existing.push(ts);
        else byChannel.set(channel, [ts]);
    }

    return [...byChannel].map(([channel, timestamps]) => ({ channel, timestamps }));
}

export async function runNuke(
    targets: NukeTarget[],
    user: string,
    admin: string,
    windowLabel: string,
    reason: string
): Promise<void> {
    const total = targets.reduce((sum, t) => sum + t.timestamps.length, 0);
    const started = Date.now();
    const reasonText = reason || '(none provided)';

    const progress = await logInternal(
        `:spin-loading: <@${admin}> is nuking \`${total}\` messages from <@${user}> across \`${targets.length}\` channels (${windowLabel}).\nReason: ${reasonText}`
    );

    let deleted = 0;
    let done = 0;

    for (const { channel, timestamps } of targets) {
        deleted += await deleteMessages(channel, timestamps);
        done++;

        if (progress?.ts && done % 5 === 0 && done < targets.length) {
            try {
                await client.chat.update({
                    channel: env.MIRRORCHANNEL,
                    ts: progress.ts,
                    text: `:spin-loading: Nuking messages from <@${user}> — \`${deleted}/${total}\` deleted (\`${done}/${targets.length}\` channels).`,
                });
            } catch (e) {
                console.error('[nuke] failed to update progress:', e);
            }
        }
    }

    const elapsed = Math.floor((Date.now() - started) / 1000);
    const summary = `<@${admin}> nuked \`${deleted}/${total}\` messages from <@${user}> across \`${targets.length}\` channels (${windowLabel}) in \`${elapsed}s\`.\nReason: ${reasonText}`;

    if (progress?.ts) {
        try {
            await client.chat.update({
                channel: env.MIRRORCHANNEL,
                ts: progress.ts,
                text: summary,
            });
            return;
        } catch (e) {
            console.error('[nuke] failed to finalise progress:', e);
        }
    }

    await logInternal(summary);
}
