import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin } from '../../utils/index.js';

async function banListCommand({
    payload: { user_id, channel_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);

    const errors: string[] = [];
    if (!isAdmin) errors.push('Only admins can run this command.');

    const channelBans = await prisma.user.findMany();
    const shushBans = await prisma.bans.findMany({
        select: { user: true },
    });
    console.log(channelBans);
    console.log(shushBans);
}

export default banListCommand;
