import { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { getPrisma, logInternal } from '../../utils/index.js';
import { uninstallApp } from './helpers.js';

async function listenForAppInstalled({
    event,
}: SlackEventMiddlewareArgs<'app_installed'> & AllMiddlewareArgs) {
    const prisma = getPrisma();

    const bannedBot = await prisma.bannedBot.findUnique({
        where: { appId: event.app_id },
    });

    if (!bannedBot) return;

    const success = await uninstallApp(event.app_id);

    if (success) {
        await logInternal(
            `🚫 <@${event.user_id}> installed banned bot "${event.app_name}" (${event.app_id}), uninstalled. Original ban reason: ${bannedBot.reason}`
        );
    } else {
        await logInternal(
            `⚠️ Failed to uninstall banned bot "${event.app_name}" (${event.app_id}) installed by <@${event.user_id}>. Original ban reason: ${bannedBot.reason}. Please uninstall manually.`
        );
    }
}

export default listenForAppInstalled;
