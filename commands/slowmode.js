const chrono = require('chrono-node');
const { getPrisma } = require('../utils/prismaConnector');
const getChannelManagers = require("../utils/isChannelManger");


async function slowmode(args) {
    const { payload, client } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();
    const commands = text.split(" ");
    const userInfo = await client.users.info({ user: user_id });
    const isAdmin = userInfo.user.is_admin;
    const channelManagers = await getChannelManagers(channel_id);
    const time = Number(commands[commands[0] && commands[0].includes('#') ? 1: 0])

    let channel = channel_id;
    if (commands[0] && commands[0].includes('#')) {
        channel = commands[0].split('|')[0].replace("<#", "").replace(">", "");
    }

    const errors = []
    if (!isAdmin && !channelManagers.includes(user_id)) errors.push("Only admins can run this command.");
    if (!channel) errors.push("You need to give a channel to make it read only");
    if (!time) errors.push("You need to specify a valid time in seconds");

    if (errors.length > 0)
        return await client.chat.postEphemeral({
            channel: `${channel_id}`,
            user: `${user_id}`,
            text: errors.join("\n")
        });

    const existingSlowmode = await prisma.Slowmode.findFirst({
        where: { channel: channel }
    });

    try {
        if (existingSlowmode) {
            if (time === 0) {
                await prisma.Slowmode.delete({
                    where: {id: existingSlowmode.id},
                });

                await client.chat.postMessage({
                    channel: process.env.MIRRORCHANNEL,
                    text: `<@${user_id}> turned off slowmode in <#${channel}>`
                });
                await client.chat.postMessage({
                    channel: channel,
                    user: user_id,
                    text: `Slowmode has been enabled - ${time.toString()} second wait between each message`
                });
            } else {
                await prisma.Slowmode.update({
                    where: {id: existingSlowmode.id},
                    data: {
                        locked: true,
                        time: time,
                    }
                });
            }
        } else {
            await prisma.Slowmode.create({
                data: {
                    channel: channel,
                    locked: true,
                    time: time,
                }
            });

            await client.chat.postMessage({
                channel: process.env.MIRRORCHANNEL,
                text: `<@${user_id}> turned on slowmode in <#${channel}> - ${time.toString()} second wait between each message`
            });
            await client.chat.postMessage({
                channel: channel,
                user: user_id,
                text: `Slowmode has been enabled - ${time.toString()} second wait between each message`
            });
        }
    } catch(e) {
        console.log(e);
    }

    // TODO: send message in firehouse logs
    // TODO: cancel slowmode
    }

module.exports = slowmode;