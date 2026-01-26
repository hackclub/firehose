const { getPrisma, isUserAdmin } = require('../../utils');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function banListCommand(args) {
    const { payload } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();

    const isAdmin = await isUserAdmin(user_id);

    const errors = [];
    if (!isAdmin) errors.push('Only admins can run this command.');

    const channelBans = await prisma.user.findMany();
    const shushBans = await prisma.bans.findMany({
        select: { user: true },
    });
    console.log(channelBans);
    console.log(shushBans);
}

module.exports = banListCommand;
