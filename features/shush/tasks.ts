import { getPrisma, postMessage, logInternal } from '../../utils/index.js';

const prisma = getPrisma();

function startAutoUnshush() {
    async function autoUnshush() {
        const expired = await prisma.bans.findMany({
            where: {
                expiresAt: { lte: new Date() },
            },
        });

        for (const ban of expired) {
            if (!ban.user) continue;

            await prisma.bans.delete({ where: { id: ban.id } });
            await Promise.all([
                postMessage(ban.user, 'You have been unshushed.'),
                logInternal(
                    `<@${ban.user}>'s shush has expired. They have been automatically unshushed.`
                ),
            ]);
        }
    }

    setInterval(autoUnshush, 1000 * 60);
    autoUnshush();
}

export default startAutoUnshush;
