import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin, postEphemeral, logInternal } from '../../utils/index.js';
import { resolveToAppId, uninstallApp } from './helpers.js';

async function botBanCommand({
    payload: { user_id, text, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
        return await postEphemeral(channel_id, user_id, 'Only admins can run this command.');
    }

    const parts = text.trim().split(/\s+/);
    const botInput = parts[0];
    const reason = parts.slice(1).join(' ');

    if (!botInput) {
        return await postEphemeral(
            channel_id,
            user_id,
            'Usage: /botban <@bot> or <bot_id> or <app_id> [reason]'
        );
    }

    if (!reason) {
        return await postEphemeral(channel_id, user_id, 'A reason is required.');
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

    if (existing) {
        return await postEphemeral(
            channel_id,
            user_id,
            `App ${resolved.appId}${resolved.name ? ` (${resolved.name})` : ''} is already banned.`
        );
    }

    await prisma.bannedBot.create({
        data: {
            appId: resolved.appId,
            reason,
            admin: user_id,
        },
    });

    const botDescription = resolved.name ? `${resolved.name} (${resolved.appId})` : resolved.appId;
    const uninstalled = await uninstallApp(resolved.appId);

    const statusMsg = uninstalled
        ? `Banned and uninstalled bot: ${botDescription}\nReason: ${reason}`
        : `Banned bot: ${botDescription}\nReason: ${reason}\n(Bot was not currently installed or could not be uninstalled)`;

    await Promise.all([
        postEphemeral(channel_id, user_id, statusMsg),
        logInternal(`<@${user_id}> banned bot ${botDescription} for: ${reason}${uninstalled ? ' (uninstalled)' : ''}`),
    ]);
}

export default botBanCommand;
