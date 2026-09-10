import { getPrisma, deleteMessages, logInternal, client, env } from '../../utils/index.js';

export type NukeTarget = {
    channel: string;
    timestamps: string[];
};

export async function collectTargets(user: string, since: Date): Promise<NukeTarget[]> {
    const prisma = getPrisma();
    const rows = await prisma.messageIndex.findMany({
        where: { user, sentAt: { gte: since } },
        select: { channel: true, ts: true },
        orderBy: { sentAt: 'desc' },
    });

    const byChannel = new Map<string, string[]>();
    for (const row of rows) {
        const existing = byChannel.get(row.channel);
        if (existing) existing.push(row.ts);
        else byChannel.set(row.channel, [row.ts]);
    }

    return [...byChannel].map(([channel, timestamps]) => ({ channel, timestamps }));
}

export async function countThreadParents(targets: NukeTarget[]): Promise<number> {
    const prisma = getPrisma();
    let parents = 0;

    for (const { channel, timestamps } of targets) {
        const replies = await prisma.messageIndex.findMany({
            where: { channel, threadTs: { in: timestamps } },
            select: { threadTs: true },
            distinct: ['threadTs'],
        });
        parents += replies.filter((r) => r.threadTs && timestamps.includes(r.threadTs)).length;
    }

    return parents;
}

export async function runNuke(
    targets: NukeTarget[],
    user: string,
    admin: string,
    windowLabel: string,
    reason: string
): Promise<void> {
    const prisma = getPrisma();
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

        await prisma.messageIndex.deleteMany({
            where: { channel, ts: { in: timestamps } },
        });

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
