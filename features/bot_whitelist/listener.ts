import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    client,
    userClient,
    logInternal,
    deleteMessage,
    getMessageLink,
    getPrisma,
} from '../../utils/index.js';
import * as api from './api.js';

/**
 * Listener for the member_joined_channel event.
 * Automatically kicks bots that are not on the whitelist if protection is enabled for that channel.
 */
async function onMemberJoined({
    event,
}: SlackEventMiddlewareArgs<'member_joined_channel'> & AllMiddlewareArgs) {
    const { user, channel } = event;

    try {
        const config = await api.getWhitelistConfig(channel);
        if (!config || !config.enabled) return;

        const [userInfo, authInfo] = await Promise.all([
            client.users.info({ user }),
            client.auth.test(),
        ]);

        const isBot = userInfo.user?.is_bot || false;
        const isSelf = user === authInfo.user_id;

        if (isSelf) return;

        const isWhitelisted = config.botIds.includes(user);

        if (isBot && !isWhitelisted) {
            await userClient.conversations.kick({
                channel,
                user,
            });

            await logInternal(
                `*Bot Protection:* Kicked unauthorized bot *${userInfo.user?.real_name || user}* from <#${channel}>.`
            );
        }
    } catch (e) {
        console.error(`Error in onMemberJoined bot whitelist enforcement:`, e);
    }
}

/**
 * Message listener to catch unauthorized bot messages (including chat:write.public).
 * Deletes messages from bots not on the whitelist in protected channels,
 * including thread replies.
 */
async function messageListener({
    payload: message,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!message || !message.channel) return;
    const { channel, ts, subtype } = message;

    const isBot = subtype === 'bot_message' || 'bot_id' in message;
    if (!isBot) return;

    const threadTs = 'thread_ts' in message ? (message.thread_ts as string | undefined) : undefined;
    const isThreadReply = !!threadTs && threadTs !== ts;

    try {
        const config = await api.getWhitelistConfig(channel);
        if (!config || !config.enabled) return;

        const botId = 'bot_id' in message ? (message.bot_id as string) : undefined;
        const userId = 'user' in message ? (message.user as string) : undefined;
        const identifier = userId || botId;

        if (!identifier) return;

        const [userInfo, botInfo, authInfo] = await Promise.all([
            userId ? client.users.info({ user: userId }).catch(() => null) : Promise.resolve(null),
            botId ? client.bots.info({ bot: botId }).catch(() => null) : Promise.resolve(null),
            client.auth.test(),
        ]);

        if (identifier === authInfo.user_id || botId === authInfo.bot_id) return;

        const botUserId = (botInfo as any)?.bot?.user_id as string | undefined;

        console.log('[bot-whitelist] message check:', {
            userId,
            botId,
            botUserId,
            whitelist: config.botIds,
        });

        const isWhitelisted =
            config.botIds.includes(userId ?? '') ||
            config.botIds.includes(botId ?? '') ||
            (botUserId ? config.botIds.includes(botUserId) : false);

        console.log('[bot-whitelist] isWhitelisted:', isWhitelisted);

        if (!isWhitelisted) {
            const deletePromise = deleteMessage(channel, ts);
            const shushableUserIds = [userId, botUserId].filter((id): id is string => Boolean(id));
            const shushedBot =
                shushableUserIds.length > 0
                    ? await getPrisma().bans.findFirst({
                          where: { user: { in: shushableUserIds } },
                          select: { id: true },
                      })
                    : null;

            if (shushedBot) {
                await deletePromise;
                return;
            }

            const messageLink = getMessageLink(channel, ts, threadTs);
            const appId = botInfo?.bot?.app_id || userInfo?.user?.profile?.api_app_id;
            const displayName = userInfo?.user?.real_name || botInfo?.bot?.name || identifier;
            const marketplaceLink = appId
                ? `\n*Manage this bot:* https://hackclub.slack.com/marketplace/${appId}`
                : '';
            const messageKind = isThreadReply ? 'thread reply' : 'top-level message';

            await Promise.all([
                deletePromise,
                logInternal(
                    `*Bot Protection:* Deleted ${messageKind} from unauthorized bot *${displayName}* in <#${channel}>.\n` +
                        `*Original Message:* ${messageLink}${marketplaceLink}`
                ),
            ]);
        }
    } catch (e) {
        console.error(`Error in messageListener bot whitelist enforcement:`, e);
    }
}

export { onMemberJoined, messageListener };
