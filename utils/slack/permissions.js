const { env } = require('../env');
const { client } = require('../../client');

/** @type {Map<string, {managers: string[], expiresAt: number}>} */
const channelManagersCache = new Map();
const CHANNEL_CACHE_TTL_MS = 60 * 1000;

/** @type {Map<string, {isAdmin: boolean, expiresAt: number}>} */
const userInfoCache = new Map();
const USER_CACHE_TTL_MS = 60 * 1000;

/**
 * @param {string} channel
 * @returns {Promise<string[]>}
 */
async function getChannelManagers(channel) {
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

    /** @type {RequestInit} */
    const requestOptions = {
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

/**
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isUserAdmin(userId) {
    const cached = userInfoCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.isAdmin;
    }
    const userInfo = await client.users.info({ user: userId });
    const isAdmin = userInfo.user?.is_admin || false;
    userInfoCache.set(userId, { isAdmin, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return isAdmin;
}

/**
 * @param {string} userId
 * @param {string} channel
 * @param {string[]} [whitelistedUsers]
 * @returns {Promise<boolean>}
 */
async function isUserExempt(userId, channel, whitelistedUsers = []) {
    const isAdmin = await isUserAdmin(userId);
    if (isAdmin) return true;
    const managers = await getChannelManagers(channel);
    if (managers.includes(userId)) return true;
    if (whitelistedUsers.includes(userId)) return true;
    return false;
}

module.exports = {
    getChannelManagers,
    isUserAdmin,
    isUserExempt,
};
