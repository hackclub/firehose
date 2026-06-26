import { getPrisma } from '../../utils/index.js';

export async function getWhitelistConfig(channelId: string) {
    const prisma = getPrisma();
    return await prisma.botWhitelist.findUnique({
        where: { channelId },
    });
}

export async function enableWhitelist(channelId: string) {
    const prisma = getPrisma();
    return await prisma.botWhitelist.upsert({
        where: { channelId },
        update: { enabled: true },
        create: { channelId, enabled: true },
    });
}

export async function disableWhitelist(channelId: string) {
    const prisma = getPrisma();
    return await prisma.botWhitelist.upsert({
        where: { channelId },
        update: { enabled: false },
        create: { channelId, enabled: false },
    });
}

export async function addBotToWhitelist(channelId: string, botId: string) {
    const prisma = getPrisma();
    const config = await getWhitelistConfig(channelId);
    
    if (config?.botIds.includes(botId)) return config;

    return await prisma.botWhitelist.upsert({
        where: { channelId },
        update: { botIds: { push: botId } },
        create: { channelId, enabled: false, botIds: [botId] },
    });
}

export async function removeBotFromWhitelist(channelId: string, botId: string) {
    const prisma = getPrisma();
    const config = await getWhitelistConfig(channelId);
    if (!config) return null;

    return await prisma.botWhitelist.update({
        where: { channelId },
        data: {
            botIds: config.botIds.filter((id) => id !== botId),
        },
    });
}
