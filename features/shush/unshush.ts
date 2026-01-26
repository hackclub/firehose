import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserAdmin, postMessage, logInternal } from '../../utils/index.js';

async function unshushCommand({
    payload: { user_id, text },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();
    const commands = text.split(' ');
    const isAdmin = await isUserAdmin(user_id);
    const userToBan = commands[0].match(/<@([A-Z0-9]+)\|?.*>/)?.[1];
    console.log(userToBan);

    if (!isAdmin || !userToBan) {
        return;
    }

    await logInternal(`<@${userToBan}> was unshushed`);

    await prisma.bans.deleteMany({
        where: { user: userToBan },
    });

    console.log("I'm working");

    await postMessage(userToBan, `You were unshushed`);
}

export default unshushCommand;
