const { getPrisma } = require('../utils/prismaConnector');
require('dotenv').config();

/** @param {import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs} args */
async function listenforChannelBannedUser(args) {
    const { client, payload } = args;
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;
    const prisma = getPrisma();

    if (subtype === 'bot_message' || !user) return;
    const userID = user;
    const slackChannel = channel;
    let messageText = text;
    let userData = await prisma.user.findFirst({
        where: {
            user: userID,
            channel: slackChannel,
        },
    });

    if (!userData) return;

    await client.chat.delete({
        channel: slackChannel,
        ts: ts,
        token: process.env.SLACK_USER_TOKEN,
    });
    try {
        await client.conversations.kick({
            channel: slackChannel,
            user: userID,
            token: process.env.SLACK_USER_TOKEN,
        });
    } catch (e) {
        console.log('kicking failed');
    }

    await client.chat.postEphemeral({
        channel: channel,
        user: user,
        text: `Your message has been deleted because you're banned from this channel because ${userData.reason}`,
    });

    // messageText = `> ${messageText}`
    // console.log("mirroring message")
    // let mirrorChannel = process.env.MIRRORCHANNEL;
    // await client.chat.postMessage({
    //     channel: mirrorChannel,
    //     text: `${messageText}\nMessaged deleted in <#${channel}>`,
    //     username: userData.display_name,
    //     icon_url: userData.profile_photo
    // });

    // try {
    //     await client.chat.postEphemeral({
    //         channel: mirrorChannel,
    //         user: userID,
    //         text: `:wave_pikachu_2: Your message was deleted because ${userData.reason}`,
    //     });
    // } catch (e) {
    //     console.error(`An error occurred: ${e}`);
    // }
}

module.exports = listenforChannelBannedUser;
