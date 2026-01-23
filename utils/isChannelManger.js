const { env } = require('./env');

/** @param {string} channel */
module.exports = async function getChannelManagers(channel) {
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

    if (!json.ok) return [];
    return json.role_assignments[0]?.users || [];
};
