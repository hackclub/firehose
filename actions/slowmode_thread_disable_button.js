const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockAction> & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmode_thread_disable_button(args) {
    const { ack, body, client } = args;
    const actions = /** @type {import('@slack/bolt').ButtonAction[]} */ (body.actions);
    const prisma = getPrisma();

    try {
        await ack();

        /** @type {{ channel: string, threadTs: string }} */
        const data = JSON.parse(actions[0].value || '{}');
        const { channel, threadTs } = data;
        const userInfo = await client.users.info({ user: body.user.id });
        if (!userInfo.user?.is_admin) {
            await client.chat.postEphemeral({
                channel: channel,
                thread_ts: threadTs,
                user: body.user.id,
                text: 'You must be an admin',
            });
            return;
        }

        const existingSlowmode = await prisma.slowmode.findUnique({
            where: {
                channel_threadTs: {
                    channel: channel,
                    threadTs,
                },
            },
        });

        if (!existingSlowmode || !existingSlowmode.locked) {
            await client.chat.postEphemeral({
                channel: channel,
                thread_ts: threadTs,
                user: body.user.id,
                text: `No active slowmode in this thread.`,
            });
            return;
        } else {
            await prisma.slowmode.update({
                where: {
                    channel_threadTs: {
                        channel: channel,
                        threadTs,
                    },
                },
                data: {
                    locked: false,
                    updatedAt: new Date(),
                    admin: body.user.id,
                },
            });

            await client.chat.postMessage({
                channel: env.MIRRORCHANNEL,
                text: `<@${body.user.id}> turned off Slowmode in https://hackclub.slack.com/archives/${channel}/p${threadTs.toString().replace('.', '')}`,
            });

            await client.chat.postMessage({
                channel: channel,
                thread_ts: threadTs,
                text: 'Slowmode has been turned off in this thread.',
            });
        }
    } catch (e) {
        console.error(e);
    }
}

module.exports = slowmode_thread_disable_button;
