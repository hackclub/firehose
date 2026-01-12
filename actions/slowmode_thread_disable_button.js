// this is virtually the same as slowmode_disable_button.js
const { getPrisma } = require('../utils/prismaConnector');
require('dotenv').config();

async function slowmode_disable_button(args) {
    const { ack, body, client } = args;
    const prisma = getPrisma();

    try {
        await ack();

        const data = JSON.parse(body.actions[0].value);
        const { channel, threadTs } = data;
        const actionThreadTs = body.actions[0].value && typeof body.actions[0].value === 'string' ? JSON.parse(body.actions[0].value).threadTs : threadTs;
        const userInfo = await client.users.info({ user: body.user.id });
        if (!userInfo.user.is_admin) {
            return await client.chat.postEphemeral({
                channel: channel,
                thread_ts: threadTs,
                user: body.user.id,
                text: "You must be an admin"
            });
        }

        const existingSlowmode = await prisma.Slowmode.findUnique({
            where: {
                channel_threadTs: {
                    channel: channel,
                    threadTs: actionThreadTs
                }
            }
        });

        if (!existingSlowmode || !existingSlowmode.locked) {
            return await client.chat.postEphemeral({
                channel: channel,
                thread_ts: actionThreadTs,
                user: body.user.id,
                text: `No active slowmode in this thread.`
            });
        } else {
            await prisma.Slowmode.update({
                where: {
                    channel_threadTs: {
                        channel: channel,
                        threadTs: actionThreadTs
                    }
                },
                data: {
                    locked: false,
                    updatedAt: new Date(),
                    admin: body.user.id
                }
            });

            await client.chat.postMessage({
                channel: process.env.MIRRORCHANNEL,
                text: `<@${body.user.id}> turned off Slowmode in https://hackclub.slack.com/archives/${channel}/p${actionThreadTs.toString().replace(".", "")}`
            });

            await client.chat.postMessage({
                channel: channel,
                thread_ts: actionThreadTs,
                text: "Slowmode has been turned off in this thread."
            })
        }
    } catch(e) {
        console.error(e);
    }
}

module.exports = slowmode_disable_button;
