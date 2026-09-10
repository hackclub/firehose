import { getPrisma } from '../../utils/index.js';

const ALERT_WINDOW_MS = 60 * 60 * 1000;

export type BotWhitelistAlertKey = {
    channelId: string;
    botId: string;
};

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

export async function removeBotFromWhitelist(channelId: string, ...botIds: string[]) {
    const prisma = getPrisma();
    const config = await getWhitelistConfig(channelId);
    if (!config) return null;

    return await prisma.botWhitelist.update({
        where: { channelId },
        data: {
            botIds: config.botIds.filter((id) => !botIds.includes(id)),
        },
    });
}

export async function getActiveBotWhitelistAlert(
    { channelId, botId }: BotWhitelistAlertKey,
    now = new Date()
) {
    const prisma = getPrisma();
    return await prisma.botWhitelistAlert.findFirst({
        where: {
            channelId,
            botId,
            expiresAt: { gt: now },
        },
    });
}

export async function saveBotWhitelistAlert(
    { channelId, botId }: BotWhitelistAlertKey,
    logMessageTs: string,
    windowStartedAt = new Date()
) {
    const prisma = getPrisma();
    const expiresAt = new Date(windowStartedAt.getTime() + ALERT_WINDOW_MS);

    return await prisma.botWhitelistAlert.upsert({
        where: { channelId_botId: { channelId, botId } },
        create: { channelId, botId, logMessageTs, windowStartedAt, expiresAt },
        update: { logMessageTs, windowStartedAt, expiresAt },
    });
}
