import { getPrisma, postMessage, logInternal } from '../../utils/index.js';

const prisma = getPrisma();

function startAutoUnban() {
    async function autoUnban() {
        const expired = await prisma.user.findMany({
            where: {
                expiresAt: { lte: new Date() },
            },
        });

        for (const ban of expired) {
            if (!ban.user || !ban.channel) continue;

            await prisma.user.delete({ where: { id: ban.id } });
            await Promise.all([
                postMessage(ban.user, `You have been unbanned from <#${ban.channel}>.`),
                logInternal(
                    `<@${ban.user}>'s ban from <#${ban.channel}> has expired. They have been automatically unbanned.`
                ),
            ]);
        }
    }

    setInterval(autoUnban, 1000 * 60);
    autoUnban();
}

export default startAutoUnban;
