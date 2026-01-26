const {
    getPrisma,
    isUserAdmin,
    postMessage,
    postEphemeral,
    getThreadLink,
    logInternal,
} = require('../../utils');

/** @param {import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockAction> & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmodeDisableButton(args) {
    const { ack, body } = args;
    const actions = /** @type {import('@slack/bolt').ButtonAction[]} */ (body.actions);
    const prisma = getPrisma();

    try {
        await ack();

        const data = JSON.parse(actions[0].value || '{}');
        const { channel, threadTs } = data;
        const admin_id = body.user.id;
        const isAdmin = await isUserAdmin(admin_id);
        if (!isAdmin) {
            await postEphemeral(channel, admin_id, 'You must be an admin');
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
            await postEphemeral(channel, admin_id, `No active slowmode in <#${channel}>`);
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

            await logInternal(`<@${admin_id}> turned off Slowmode in <#${channel}>`);
            await postMessage(channel, 'Slowmode has been turned off in this channel.');
        }
    } catch (e) {
        console.error(e);
    }
}

/** @param {import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockAction> & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmodeThreadDisableButton(args) {
    const { ack, body } = args;
    const actions = /** @type {import('@slack/bolt').ButtonAction[]} */ (body.actions);
    const prisma = getPrisma();

    try {
        await ack();

        /** @type {{ channel: string, threadTs: string }} */
        const data = JSON.parse(actions[0].value || '{}');
        const { channel, threadTs } = data;
        const isAdmin = await isUserAdmin(body.user.id);
        if (!isAdmin) {
            await postEphemeral(channel, body.user.id, 'You must be an admin', threadTs);
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
            await postEphemeral(
                channel,
                body.user.id,
                `No active slowmode in this thread.`,
                threadTs
            );
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

            await logInternal(
                `<@${body.user.id}> turned off Slowmode in ${getThreadLink(channel, threadTs)}`
            );

            await postMessage(channel, 'Slowmode has been turned off in this thread.', threadTs);
        }
    } catch (e) {
        console.error(e);
    }
}

module.exports = {
    slowmodeDisableButton,
    slowmodeThreadDisableButton,
};
