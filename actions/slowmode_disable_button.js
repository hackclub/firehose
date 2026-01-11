const { getPrisma } = require('../utils/prismaConnector');
require('dotenv').config();

async function slowmode_disable_button(args) {
    const { ack, body, client } = args;
    const prisma = getPrisma();

    try {
        await ack();

        const channel = body.actions[0].value;
        const admin_id = body.user.id;
        const userInfo = await client.users.info({ user: admin_id });
        if (!userInfo.user.is_admin) {
            return await client.chat.postEphemeral({
                channel: body.channel.id,
                user: admin_id,
                text: "You must be an admin"
            });
        }

        const existingSlowmode = await prisma.Slowmode.findUnique({
            where: {
                channel: channel
            }
        });

        if (!existingSlowmode || !existingSlowmode.locked) {
            return await client.chat.postEphemeral({
                channel: body.channel_id,
                user: admin_id,
                text: `No active slowmode in <#${channel}>`
            });
        } else {
            await prisma.Slowmode.update({
                where: {
                    channel: channel
                },
                data: {
                    locked: false,
                    updatedAt: new Date(),
                    admin: admin_id
                }
            });

            await client.chat.postMessage({
                channel: process.env.MIRRORCHANNEL,
                text: `<@${admin_id}> turned off Slowmode in <#${channel}>`
            });

            await client.chat.postMessage({
                channel: channel,
                text: "Slowmode has been turned off in this channel."
            })
        }
    } catch(e) {
        console.error(e);
    }
}

module.exports = slowmode_disable_button;
