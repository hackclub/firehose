import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import {
    getChannelManagers,
    isUserAdmin,
    postEphemeral,
    logInternal,
    userClient,
    client,
} from '../../utils/index.js';
import * as api from './api.js';

/**
 * Handles the /bot-whitelist command.
 * It's used for managing the allowed bots in enabled channels
 */
async function botWhitelistCommand({
    payload: { text, channel_id, user_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const args = text.split(' ').filter(Boolean);

    if (args.length < 1) {
        return await postEphemeral(
            channel_id,
            user_id,
            '*Bot Whitelist (Current Channel Only)*\n' +
                '• `/bot-whitelist status` - Show current settings\n' +
                '• `/bot-whitelist enable` - Start protecting this channel\n' +
                '• `/bot-whitelist disable` - Stop protecting this channel\n' +
                '• `/bot-whitelist add @bot` - Allow a bot here\n' +
                '• `/bot-whitelist remove @bot` - Remove bot from safe list'
        );
    }

    const action = args[0].toLowerCase();
    
    const botMatch = text.match(/<@([A-Z0-9]+)\|?.*>/);
    const botId = botMatch?.[1] || (['add', 'remove'].includes(action) ? args[1]?.replace(/^@/, '') : undefined);

    if (['add', 'remove'].includes(action) && !botId) {
        return await postEphemeral(channel_id, user_id, 'A bot mention or ID is required.');
    }

    const isAdmin = await isUserAdmin(user_id);
    let isManager = false;
    try {
        const managers = await getChannelManagers(channel_id);
        isManager = managers.includes(user_id);
    } catch (e) {
        console.error('Failed to fetch channel managers, falling back to admin check:', e);
    }

    if (!isAdmin && !isManager) {
        return await postEphemeral(channel_id, user_id, 'Only admins or channel managers can run this command.');
    }

    const auth = await client.auth.test();
    const selfId = auth.user_id;

    if (botId && (botId === selfId || botId.toLowerCase() === 'firehose')) {
        return await postEphemeral(channel_id, user_id, 'Firehose is already exempt from bot protection and cannot be added or removed from the whitelist.');
    }

    try {
        switch (action) {
            case 'status': {
                const config = await api.getWhitelistConfig(channel_id);
                if (!config) {
                    await postEphemeral(channel_id, user_id, `No configuration found for <#${channel_id}>.`);
                } else {
                    const statusEmoji = config.enabled ? '✅ Enabled' : '🚫 Disabled';
                    const botList = config.botIds.length > 0 
                        ? config.botIds.map(id => `<@${id}>`).join(', ') 
                        : '_None_';
                    
                    await postEphemeral(
                        channel_id, 
                        user_id, 
                        ` *Whitelist Status for <#${channel_id}>*\n` +
                        `• *Protection:* ${statusEmoji}\n` +
                        `• *Whitelisted Bots:* ${botList}`
                    );
                }
                break;
            }

            case 'enable':
                await api.enableWhitelist(channel_id);
                try {
                    await client.conversations.join({ channel: channel_id });
                } catch (e) {
                    console.error(`Failed to join channel ${channel_id} during enable:`, e);
                }
                await postEphemeral(channel_id, user_id, `Bot whitelisting *enabled* for <#${channel_id}>. Firehose has joined the channel to monitor for bots.`);
                await logInternal(`<@${user_id}> enabled bot whitelisting for <#${channel_id}>.`);
                break;

            case 'disable':
                await api.disableWhitelist(channel_id);
                await postEphemeral(channel_id, user_id, `Bot whitelisting *disabled* for <#${channel_id}>.`);
                await logInternal(`<@${user_id}> disabled bot whitelisting for <#${channel_id}>.`);
                break;

            case 'add':
                if (botId) {
                    await api.addBotToWhitelist(channel_id, botId);
                    await postEphemeral(channel_id, user_id, `Safe list updated: <@${botId}> is now allowed in <#${channel_id}>.`);
                    await logInternal(`<@${user_id}> added bot <@${botId}> to whitelist for <#${channel_id}>.`);
                }
                break;
case 'remove':
    if (botId) {
        const config = await api.getWhitelistConfig(channel_id);
        await api.removeBotFromWhitelist(channel_id, botId);

        if (config?.enabled) {
            try {
                const members = await client.conversations.members({ channel: channel_id });
                const lowerBotId = botId.toLowerCase();

                for (const memberId of members.members || []) {
                    try {
                        const info = await client.users.info({ user: memberId });
                        if (info.user?.is_bot) {
                            if (memberId.toLowerCase() === lowerBotId || 
                                info.user.name?.toLowerCase() === lowerBotId || 
                                info.user.real_name?.toLowerCase() === lowerBotId) {

                                await userClient.conversations.kick({ channel: channel_id, user: memberId });
                                await logInternal(`Kicked bot *${info.user.real_name || memberId}* from <#${channel_id}> after removal from whitelist.`);
                                break;
                            }
                        }
                    } catch (memberError) {
                        console.error(`Error processing member ${memberId}:`, memberError);
                    }
                }
                } catch (e) {
                console.error(`Detailed kick failure for ${botId}:`, e);
                await postEphemeral(channel_id, user_id, `Could not kick bot *${botId}*. They were removed from the whitelist, but the kick failed. Error: ${e instanceof Error ? e.message : 'Unknown'}`);
                }

        }

        await postEphemeral(channel_id, user_id, `Removed *${botId}* from the whitelist for <#${channel_id}>.`);
        await logInternal(`<@${user_id}> removed bot *${botId}* from whitelist for <#${channel_id}>.`);
    }
    break;


            default:
                await postEphemeral(channel_id, user_id, `Unknown action: *${action}*. Use: status, enable, disable, add, remove.`);
        }
    } catch (e) {
        console.error('Error in botWhitelistCommand:', e);
        await postEphemeral(channel_id, user_id, 'An error occurred while processing your request.');
    }
}

export default botWhitelistCommand;
