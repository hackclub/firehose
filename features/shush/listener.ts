import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getPrisma,
    deleteMessage,
    postMessage,
    postEphemeral,
    logInternal,
    userClient,
} from '../../utils/index.js';

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

    if (userData.expiresAt && new Date() > userData.expiresAt) {
        await prisma.bans.deleteMany({
            where: { user },
        });
        await Promise.all([
            postMessage(user, 'You have been unshushed.'),
            logInternal(`<@${user}>'s shush has expired. They have been automatically unshushed.`),
        ]);
        return;
    }

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
            `Your message was deleted because you are shushed for ${userData.reason}.${text ? `\n\nYour message was:\n${text}` : ''}`
        ),
    ]);
}

export default listenForBannedUser;
