const { client, userClient } = require('../../client');

/**
 * @param {string} channel
 * @param {string} ts
 * @returns {Promise<void>}
 */
async function deleteMessage(channel, ts) {
    await userClient.chat.delete({
        channel,
        ts,
    });
}

/**
 * @param {string} channel
 * @param {string} user
 * @param {string} text
 * @param {string} [thread_ts]
 * @returns {Promise<void>}
 */
async function postEphemeral(channel, user, text, thread_ts) {
    await client.chat.postEphemeral({
        channel,
        user,
        text,
        ...(thread_ts && { thread_ts }),
    });
}

/**
 * @param {string} channel
 * @param {string} text
 * @param {string} [thread_ts]
 * @returns {Promise<import('@slack/web-api').ChatPostMessageResponse>}
 */
async function postMessage(channel, text, thread_ts) {
    return await client.chat.postMessage({
        channel,
        text,
        ...(thread_ts && { thread_ts }),
    });
}

/**
 * @param {string} channel
 * @param {string} name
 * @param {string} timestamp
 * @returns {Promise<void>}
 */
async function addReaction(channel, name, timestamp) {
    try {
        await client.reactions.add({
            channel,
            name,
            timestamp,
        });
    } catch (e) {
        // Reaction may already exist
    }
}

/**
 * @param {string} channel
 * @param {string} name
 * @param {string} timestamp
 * @returns {Promise<void>}
 */
async function removeReaction(channel, name, timestamp) {
    try {
        await client.reactions.remove({
            channel,
            name,
            timestamp,
        });
    } catch (e) {
        // Reaction may not exist
    }
}

module.exports = {
    deleteMessage,
    postEphemeral,
    postMessage,
    addReaction,
    removeReaction,
};
