const { env } = require('./env');
const { client } = require('../client');

/**
 * Log to #community-logs
 * @param {string} text
 * @returns {Promise<void>}
 */
async function logPublic(text) {
    if (env.SLACK_LOG_CHANNEL) {
        await client.chat.postMessage({
            channel: env.SLACK_LOG_CHANNEL,
            text,
        });
    }
}

/**
 * Log to #firehouse-logs
 * @param {string} text
 * @returns {Promise<void>}
 */
async function logInternal(text) {
    await client.chat.postMessage({
        channel: env.MIRRORCHANNEL,
        text,
    });
}

/**
 * Log to both public and internal channels
 * @param {string} text
 * @returns {Promise<void>}
 */
async function logBoth(text) {
    await Promise.all([logPublic(text), logInternal(text)]);
}

/**
 * @param {string} channel
 * @param {string} ts
 * @returns {string}
 */
function getThreadLink(channel, ts) {
    return `https://hackclub.slack.com/archives/${channel}/p${ts.toString().replace('.', '')}`;
}

module.exports = {
    logPublic,
    logInternal,
    logBoth,
    getThreadLink,
};
