const { env } = require('./env');

/** @type {Map<string, {managers: string[], expiresAt: number}>} */
const channelManagersCache = new Map();
const CHANNEL_CACHE_TTL_MS = 60 * 1000;

/** @param {string} channel */
module.exports = async function getChannelManagers(channel) {
    const cached = channelManagersCache.get(channel);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.managers;
    }
    if (!env.SLACK_BROWSER_TOKEN || !env.SLACK_COOKIE) {
        throw new Error('Missing SLACK_BROWSER_TOKEN or SLACK_COOKIE in environment variables');
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
};
