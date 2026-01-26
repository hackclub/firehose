const { getPrisma, deleteMessage, postEphemeral } = require('../../utils');
const { userClient } = require('../../client');

/** @param {import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs} args */
async function listenForChannelBannedUser(args) {
    const { payload } = args;
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;
    const prisma = getPrisma();

    if (subtype === 'bot_message' || !user) return;
    const userID = user;
    const slackChannel = channel;
    let userData = await prisma.user.findFirst({
        where: {
            user: userID,
            channel: slackChannel,
        },
    });

    if (!userData) return;

    await Promise.all([
        deleteMessage(slackChannel, ts),
        userClient.conversations
            .kick({
                channel: slackChannel,
                user: userID,
            })
            .catch(() => {
                console.log('kicking failed');
            }),
        postEphemeral(
            channel,
            user,
            `Your message has been deleted because you're banned from this channel because ${userData.reason}\n\nYour message was:\n${text}`
        ),
    ]);
}

module.exports = listenForChannelBannedUser;
