const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockAction> & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmode_disable_button(args) {
    const { ack, body, client } = args;
    const actions = /** @type {import('@slack/bolt').ButtonAction[]} */ (body.actions);
    const prisma = getPrisma();

    try {
        await ack();

        const data = JSON.parse(actions[0].value || '{}');
        const { channel, threadTs } = data;
        const admin_id = body.user.id;
        const userInfo = await client.users.info({ user: admin_id });
        if (!userInfo.user?.is_admin) {
            await client.chat.postEphemeral({
                channel: channel,
                user: admin_id,
                text: 'You must be an admin',
            });
            return;
        }

        const existingSlowmode = await prisma.slowmode.findUnique({
            where: {
                channel_threadTs: {
                    channel: channel,
                    threadTs: threadTs || '',
                },
            },
        });

        if (!existingSlowmode || !existingSlowmode.locked) {
            await client.chat.postEphemeral({
                channel: channel,
                user: admin_id,
                text: `No active slowmode in <#${channel}>`,
            });
            return;
        } else {
            await prisma.slowmode.update({
                where: {
                    channel_threadTs: {
                        channel: channel,
                        threadTs: threadTs || '',
                    },
                },
                data: {
                    locked: false,
                    updatedAt: new Date(),
                    admin: admin_id,
                },
            });

            await client.chat.postMessage({
                channel: env.MIRRORCHANNEL,
                text: `<@${admin_id}> turned off Slowmode in <#${channel}>`,
            });

            await client.chat.postMessage({
                channel: channel,
                text: 'Slowmode has been turned off in this channel.',
            });
        }
    } catch (e) {
        console.error(e);
    }
}

module.exports = slowmode_disable_button;
