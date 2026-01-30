import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin, postEphemeral, logInternal } from '../../utils/index.js';
import { resolveToAppId } from './helpers.js';

async function botUnbanCommand({
    payload: { user_id, text, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
        return await postEphemeral(channel_id, user_id, 'Only admins can run this command.');
    }

    const botInput = text.trim().split(/\s+/)[0];

    if (!botInput) {
        return await postEphemeral(
            channel_id,
            user_id,
            'Usage: /botunban <@bot> or <bot_id> or <app_id>'
        );
    }

    const resolved = await resolveToAppId(botInput);
    if (!resolved) {
        return await postEphemeral(
            channel_id,
            user_id,
            `Could not resolve "${botInput}" to a bot. Provide a bot user mention (<@U...>), user ID (U...), bot ID (B...), or app ID (A...).`
        );
    }

    const existing = await prisma.bannedBot.findUnique({
        where: { appId: resolved.appId },
    });

    if (!existing) {
        return await postEphemeral(
            channel_id,
            user_id,
            `App ${resolved.appId}${resolved.name ? ` (${resolved.name})` : ''} is not banned.`
        );
    }

    await prisma.bannedBot.delete({
        where: { appId: resolved.appId },
    });

    const botDescription = resolved.name ? `${resolved.name} (${resolved.appId})` : resolved.appId;

    await Promise.all([
        postEphemeral(channel_id, user_id, `Unbanned bot: ${botDescription}`),
        logInternal(`<@${user_id}> unbanned bot ${botDescription}`),
    ]);
}

export default botUnbanCommand;
