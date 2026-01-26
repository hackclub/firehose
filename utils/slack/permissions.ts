import { env } from '../env.js';
import { client } from '../../client.js';

const channelManagersCache = new Map<string, { managers: string[]; expiresAt: number }>();
const CHANNEL_CACHE_TTL_MS = 60 * 1000;

const userInfoCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();
const USER_CACHE_TTL_MS = 60 * 1000;

export async function getChannelManagers(channel: string): Promise<string[]> {
    const cached = channelManagersCache.get(channel);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.managers;
    }
    if (!env.SLACK_BROWSER_TOKEN || !env.SLACK_COOKIE) {
        console.error('Missing SLACK_BROWSER_TOKEN or SLACK_COOKIE in environment variables');
        return [];
    }

    const myHeaders = new Headers();
    myHeaders.append('Cookie', `d=${env.SLACK_COOKIE}`);

    const formdata = new FormData();
    formdata.append('token', env.SLACK_BROWSER_TOKEN);
    formdata.append('entity_id', channel);

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: myHeaders,
        body: formdata,
        redirect: 'follow',
    };

    const request = await fetch(
        'https://slack.com/api/admin.roles.entity.listAssignments',
        requestOptions
    );

    const json = await request.json();

    if (!json.ok) {
        console.error('Error fetching channel managers:', json.error);
        return [];
    }
    const managers = json?.role_assignments?.[0]?.users || [];

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
