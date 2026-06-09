import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { client, userClient, logInternal, deleteMessage, getMessageLink } from '../../utils/index.js';
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

        const username = userInfo.user?.name?.toLowerCase();
        const realName = userInfo.user?.real_name?.toLowerCase();

        const isWhitelisted = config.botIds.some(id => {
            const lowerId = id.toLowerCase();
            return lowerId === user.toLowerCase() || 
                   lowerId === username || 
                   lowerId === realName;
        });

        if (isBot && !isWhitelisted) {
            await userClient.conversations.kick({
                channel,
                user,
            });
            
            await logInternal(`*Bot Protection:* Kicked unauthorized bot *${userInfo.user?.real_name || user}* from <#${channel}>.`);
        }
    } catch (e) {
        console.error(`Error in onMemberJoined bot whitelist enforcement:`, e);
    }
}

/**
 * Message listener to catch unauthorized bot messages (including chat:write.public).
 * Deletes top-level messages from bots not on the whitelist in protected channels.
 */
async function messageListener({
    payload: message,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!message || !message.channel) return;
    const { channel, ts, subtype } = message;

    const isBot = subtype === 'bot_message' || 'bot_id' in message;
    if (!isBot) return;

    const isThread = 'thread_ts' in message && message.thread_ts !== ts;
    if (isThread) return;

    try {
        const config = await api.getWhitelistConfig(channel);
        if (!config || !config.enabled) return;

        const botId = 'bot_id' in message ? (message.bot_id as string) : undefined;
        const userId = 'user' in message ? (message.user as string) : undefined;
        const identifier = userId || botId;

        if (!identifier) return;

        const [userInfo, authInfo] = await Promise.all([
            client.users.info({ user: identifier }).catch(() => null),
            client.auth.test(),
        ]);

        if (identifier === authInfo.user_id || botId === authInfo.bot_id) return;

        const username = userInfo?.user?.name?.toLowerCase();
        const realName = userInfo?.user?.real_name?.toLowerCase();

        const isWhitelisted = config.botIds.some((id) => {
            const lowerId = id.toLowerCase();
            return (
                lowerId === identifier.toLowerCase() ||
                lowerId === username ||
                lowerId === realName
            );
        });

        if (!isWhitelisted) {
            const messageLink = getMessageLink(channel, ts);
            const appId = userInfo?.user?.profile?.api_app_id || 'unknown';
            const marketplaceLink = appId !== 'unknown' 
                ? `\n*Manage this bot:* https://hackclub.slack.com/marketplace/${appId}`
                : '';
            
            await logInternal(
                `*Bot Protection:* Deleted top-level message from unauthorized bot *${userInfo?.user?.real_name || identifier}* in <#${channel}>.\n` +
                `*Original Message:* ${messageLink}${marketplaceLink}`
            );

            await deleteMessage(channel, ts);
        }
    } catch (e) {
        console.error(`Error in messageListener bot whitelist enforcement:`, e);
    }
}

export { onMemberJoined, messageListener };
