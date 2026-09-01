import { client } from './client.js';
import { isUserAPIAvailable, userAPI } from './userAPI.js';
import { env } from '../env.js';

const channelManagersCache = new Map<string, { managers: string[]; expiresAt: number }>();
const CHANNEL_CACHE_TTL_MS = 60 * 1000;

const userInfoCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();
const USER_CACHE_TTL_MS = 60 * 1000;

const FIREHOUSE = 'G01DBHPLK25';

export async function getChannelManagers(channel: string): Promise<string[]> {
    const cached = channelManagersCache.get(channel);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.managers;
    }

    if (!isUserAPIAvailable) {
        return [];
    }

    const json = await userAPI('admin.roles.entity.listAssignments', { entity_id: channel });
    const assignment = json?.role_assignments?.find(
        (a: { role_id: string }) => a.role_id === 'Rl0A'
    );
    const managers = assignment?.users || [];

    channelManagersCache.set(channel, {
        managers,
        expiresAt: Date.now() + CHANNEL_CACHE_TTL_MS,
    });

    return managers;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
    const cached = userInfoCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.isAdmin;
    }

    const userInfo = await client.users.info({ user: userId });
    const isAdmin = userInfo.user?.is_admin || false;

    userInfoCache.set(userId, { isAdmin, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return isAdmin;
}

export async function isUserInFirehouse(userId: string): Promise<boolean> {
    let cursor: string | undefined;

    do {
        const result = await client.conversations.members({
            channel: FIREHOUSE,
            limit: 200,
            cursor,
        });
        if (result.members?.includes(userId)) {
            return true;
        }
        cursor = result.response_metadata?.next_cursor;
    } while (cursor);
    return false;
}

export function isUserOwner(userId: string): boolean {
    return env.SUPERADMIN_IDS.split(',').map(id => id.trim()).filter(Boolean).includes(userId);
}

export async function isUserExempt(
    userId: string,
    channel: string,
    whitelistedUsers: string[] = []
): Promise<boolean> {
    const isAdmin = await isUserAdmin(userId);
    if (isAdmin) return true;
    const managers = await getChannelManagers(channel);
    if (managers.includes(userId)) return true;
    if (whitelistedUsers.includes(userId)) return true;
    return false;
}
