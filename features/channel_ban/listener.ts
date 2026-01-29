import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, deleteMessage, postEphemeral, userClient } from '../../utils/index.js';

async function listenForChannelBannedUser({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
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
                console.error(`Failed to kick user ${userID} from channel ${slackChannel}`);
            }),
        postEphemeral(
            channel,
            user,
            `Your message has been deleted because you're banned from this channel because ${userData.reason}\n\nYour message was:\n${text}`
        ),
    ]);
}

export default listenForChannelBannedUser;
