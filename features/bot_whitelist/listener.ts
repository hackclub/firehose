import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { client, userClient, logInternal } from '../../utils/index.js';
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
            client.auth.test()
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

export default onMemberJoined;
