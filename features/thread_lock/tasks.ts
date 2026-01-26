import { getPrisma, removeReaction, logBoth, getThreadLink } from '../../utils/index.js';

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

            await logBoth(
                `🔓 Thread unlocked in <#${thread.channel}>
Reason: Autounlock (triggered by cron job)
Admin: System
Link: ${getThreadLink(thread.channel, thread.id)}`
            );

            await prisma.log.create({
                data: {
                    thread_id: thread.id,
                    admin: 'system',
                    lock_type: 'unlock',
                    time: new Date(),
                    reason: 'Autounlock (cron job)',
                    channel: thread.channel,
                    active: false,
                },
            });

            try {
                await removeReaction(thread.channel, 'lock', thread.id);
            } catch (e) {}

            await prisma.thread.update({
                where: {
                    id: thread.id,
                },
                data: {
                    active: false,
                },
            });
        }
    }

    setInterval(autoUnlock, 1000 * 60);
    autoUnlock();
}

export default startAutoUnlock;
