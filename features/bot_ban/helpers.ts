import { client, logInternal } from '../../utils/index.js';

export type BotIdType = 'appId' | 'botId' | 'userId';

export async function uninstallApp(appId: string): Promise<boolean> {
    const teamInfo = await client.team.info();
    const enterpriseId = teamInfo.team?.enterprise_id;
    const teamId = teamInfo.team?.id;

    try {
        if (enterpriseId) {
            await client.admin.apps.uninstall({
                app_id: appId,
                enterprise_id: enterpriseId,
            });
        } else if (teamId) {
            await client.admin.apps.uninstall({
                app_id: appId,
                team_id: teamId,
            });
        } else {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export interface ResolvedBotInfo {
    appId: string;
    botId?: string;
    userId?: string;
    name?: string;
}

export function parseInput(input: string): { id: string; type: BotIdType } | null {
    const trimmed = input.trim();

    const userMention = trimmed.match(/<@([A-Z0-9]+)\|?[^>]*>/);
    if (userMention) {
        return { id: userMention[1], type: 'userId' };
    }

    if (trimmed.startsWith('U') && /^U[A-Z0-9]+$/.test(trimmed)) {
        return { id: trimmed, type: 'userId' };
    }

    if (trimmed.startsWith('B') && /^B[A-Z0-9]+$/.test(trimmed)) {
        return { id: trimmed, type: 'botId' };
    }

    if (trimmed.startsWith('A') && /^A[A-Z0-9]+$/.test(trimmed)) {
        return { id: trimmed, type: 'appId' };
    }

    return null;
}

export async function resolveToAppId(input: string): Promise<ResolvedBotInfo | null> {
    const parsed = parseInput(input);
    if (!parsed) return null;

    const { id, type } = parsed;

    if (type === 'appId') {
        return { appId: id };
    }

    if (type === 'botId') {
        const botInfo = await client.bots.info({ bot: id });
        if (!botInfo.ok || !botInfo.bot?.app_id) {
            return null;
        }
        return {
            appId: botInfo.bot.app_id,
            botId: id,
            userId: botInfo.bot.user_id,
            name: botInfo.bot.name,
        };
    }

    if (type === 'userId') {
        const userInfo = await client.users.info({ user: id });
        if (!userInfo.ok || !userInfo.user) {
            return null;
        }

        if (!userInfo.user.is_bot) {
            return null;
        }

        const profile = userInfo.user.profile;
        if (!profile?.api_app_id) {
            return null;
        }

        return {
            appId: profile.api_app_id,
            userId: id,
            botId: userInfo.user.profile?.bot_id,
            name: userInfo.user.real_name || userInfo.user.name,
        };
    }

    return null;
}
