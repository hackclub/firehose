import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, deleteMessage, postEphemeral } from '../../utils/index.js';
import { userClient } from '../../client.js';

async function listenForBannedUser({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;
    const prisma = getPrisma();
    if (subtype === 'bot_message' || !user) return;
    const userID = user;
    const slackChannel = channel;
    let userData = await prisma.bans.findFirst({
        where: {
            user: userID,
        },
    });

    if (!userData) return;

    try {
        await deleteMessage(slackChannel, ts);
    } catch (e) {
        console.error(e);
    }
    try {
        await userClient.conversations.kick({
            channel: slackChannel,
            user: userID,
        });
    } catch (e) {
        console.log('kicking failed');
    }

    await postEphemeral(
        channel,
        user,
        `Your message has been deleted because you're muted for ${userData.reason}`
    );
}

export default listenForBannedUser;
