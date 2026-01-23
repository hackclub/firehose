const chrono = require('chrono-node');
const { getPrisma } = require('../utils/prismaConnector');
const channelBan = require('./channelBan');
require('dotenv').config();

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function banList(args) {
    const { payload, client } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();

    const userInfo = await client.users.info({ user: user_id });
    const isAdmin = userInfo.user?.is_admin;

    const errors = [];
    if (!isAdmin) errors.push('Only admins can run this command.');

    const channelBans = await prisma.user.findMany();
    const shushBans = await prisma.bans.findMany({
        select: { user: true },
    });
    console.log(channelBans);
    console.log(shushBans);
}

module.exports = banList;
