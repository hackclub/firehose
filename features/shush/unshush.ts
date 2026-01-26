const { getPrisma, isUserAdmin, postMessage, logInternal } = require('../../utils');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function unshushCommand(args) {
    const { payload } = args;
    const { user_id, text, channel_id } = payload;
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

module.exports = unshushCommand;
