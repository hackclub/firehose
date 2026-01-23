/** @param {import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs} args */
async function channelJoin(args) {
    const { client, payload } = args;
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;

    try {
        await client.conversations.join({ channel });
    } catch (e) {
        console.log(e);
    }
}

module.exports = channelJoin;
