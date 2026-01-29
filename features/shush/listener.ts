import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, deleteMessage, postEphemeral, userClient } from '../../utils/index.js';

async function listenForBannedUser({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;
    if (subtype === 'bot_message' || !user) return;

    const prisma = getPrisma();
    let userData = await prisma.bans.findFirst({
        where: {
            user,
        },
    });
    if (!userData) return;

    await Promise.all([
        deleteMessage(channel, ts),
        userClient.conversations
            .kick({
                channel,
                user,
            })
            .catch((e) => {
                console.error(`Failed to kick user ${user} from channel ${channel}:`, e);
            }),
        postEphemeral(
            channel,
            user,
            `Your message has been deleted because you're muted for ${userData.reason}\n\nYour message was:\n${text}`
        ),
    ]);
}

export default listenForBannedUser;
