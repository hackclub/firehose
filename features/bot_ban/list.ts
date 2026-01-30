import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin, postEphemeral, client } from '../../utils/index.js';

async function botBanListCommand({
    payload: { user_id, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
        return await postEphemeral(channel_id, user_id, 'Only admins can run this command.');
    }

    const bannedBots = await prisma.bannedBot.findMany({
        orderBy: { createdAt: 'desc' },
    });

    if (bannedBots.length === 0) {
        return await postEphemeral(channel_id, user_id, 'No bots are currently banned.');
    }

    const lines: string[] = ['*Banned Bots:*\n'];

    for (const ban of bannedBots) {
        let botUserId: string | undefined;
        let botName: string | undefined;

        try {
            const teamInfo = await client.team.info();
            const teamId = teamInfo.team?.id;

            if (teamId) {
                const botsResponse = await client.users.list({});
                const botUser = botsResponse.members?.find(
                    (m) => m.is_bot && m.profile?.api_app_id === ban.appId
                );
                if (botUser) {
                    botUserId = botUser.id;
                    botName = botUser.real_name || botUser.name;
                }
            }
        } catch {}

        const marketplaceUrl = `https://hackclub.slack.com/marketplace/${ban.appId}`;
        const userMention = botUserId ? `<@${botUserId}>` : 'Unknown';
        const displayName = botName || ban.appId;

        lines.push(
            `• ${displayName} - ${userMention} | <${marketplaceUrl}|Marketplace>\n  App ID: \`${ban.appId}\`\n  Reason: ${ban.reason}\n  Banned by: <@${ban.admin}>\n`
        );
    }

    await postEphemeral(channel_id, user_id, lines.join('\n'));
}

export default botBanListCommand;
