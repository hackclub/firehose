import { getPrisma, logInternal, getThreadLink } from '../../utils/index.js';

const prisma = getPrisma();

function startAutoExpire() {
    async function autoExpire() {
        const expired = await prisma.slowmode.findMany({
            where: {
                locked: true,
                expiresAt: { lte: new Date() },
            },
        });

        for (const config of expired) {
            await Promise.all([
                prisma.slowmode.update({
                    where: { id: config.id },
                    data: { locked: false },
                }),
                prisma.slowUsers.deleteMany({
                    where: { channel: config.channel, threadTs: config.threadTs },
                }),
            ]);

            const locationText = config.threadTs
                ? `a thread in <#${config.channel}>.\nLink: ${getThreadLink(config.channel, config.threadTs)}`
                : `<#${config.channel}>.`;

            await logInternal(`Slowmode expired in ${locationText}`);
        }
    }

    setInterval(autoExpire, 1000 * 60);
    autoExpire();
}

export default startAutoExpire;
