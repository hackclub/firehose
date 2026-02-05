import {
    getPrisma,
    removeReaction,
    logBoth,
    getThreadLink,
    isUserAPIAvailable,
    unlockThread,
} from '../../utils/index.js';

const prisma = getPrisma();

function startAutoUnlock() {
    async function autoUnlock() {
        const threads = await prisma.thread.findMany({
            where: {
                time: {
                    lte: new Date(),
                },
                active: true,
            },
        });

        for (const thread of threads) {
            if (!thread.channel) continue;

            await Promise.all([
                prisma.log.create({
                    data: {
                        thread_id: thread.id,
                        admin: 'system',
                        lock_type: 'unlock',
                        time: new Date(),
                        reason: 'Autounlock (cron job)',
                        channel: thread.channel,
                        active: false,
                    },
                }),
                prisma.thread.update({
                    where: {
                        id: thread.id,
                    },
                    data: {
                        active: false,
                    },
                }),
                (async () => {
                    if (isUserAPIAvailable && thread.channel) {
                        try {
                            // In case the thread is locked via Slack too, try to unlock it
                            await unlockThread(thread.channel, thread.id);
                        } catch {}
                    }
                })(),
            ]);

            await Promise.all([
                logBoth(
                    `A thread in <#${thread.channel}> was automatically unlocked.\nLink: ${getThreadLink(thread.channel, thread.id)}`
                ),
                removeReaction(thread.channel, 'lock', thread.id),
            ]);
        }
    }

    setInterval(autoUnlock, 1000 * 60);
    autoUnlock();
}

export default startAutoUnlock;
