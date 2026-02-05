import type {
    SlackActionMiddlewareArgs,
    BlockAction,
    AllMiddlewareArgs,
    ButtonAction,
} from '@slack/bolt';
import {
    getPrisma,
    isUserAdmin,
    postMessage,
    postEphemeral,
    logInternal,
} from '../../utils/index.js';

async function slowmodeDisableButton({
    ack,
    body,
    client,
}: SlackActionMiddlewareArgs<BlockAction> & AllMiddlewareArgs) {
    const actions = body.actions as ButtonAction[];
    const prisma = getPrisma();

    try {
        ack();

        const data = JSON.parse(actions[0].value || '{}');
        const { channel, threadTs } = data;
        const admin_id = body.user.id;
        const isAdmin = await isUserAdmin(admin_id);
        if (!isAdmin) {
            await postEphemeral(channel, admin_id, 'You must be an admin');
            return;
        }

        if (body.view?.id) {
            await client.views.update({
                view_id: body.view.id,
                view: {
                    type: 'modal',
                    title: { type: 'plain_text', text: 'Slowmode' },
                    close: { type: 'plain_text', text: 'Close' },
                    blocks: [
                        {
                            type: 'section',
                            text: { type: 'mrkdwn', text: '✅ Slowmode has been disabled.' },
                        },
                    ],
                },
            });
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

            await prisma.slowUsers.deleteMany({
                where: {
                    channel: channel,
                    threadTs: threadTs || '',
                },
            });

            await logInternal(`<@${admin_id}> disabled slowmode in <#${channel}>.`);
            await postMessage(channel, 'Slowmode is disabled in this channel.');
        }
    } catch (e) {
        console.error(e);
    }
}

async function slowmodeThreadDisableButton({
    ack,
    body,
    client,
}: SlackActionMiddlewareArgs<BlockAction> & AllMiddlewareArgs) {
    const actions = body.actions as ButtonAction[];
    const prisma = getPrisma();

    try {
        ack();

        const data: { channel: string; threadTs: string } = JSON.parse(actions[0].value || '{}');
        const { channel, threadTs } = data;
        const isAdmin = await isUserAdmin(body.user.id);
        if (!isAdmin) {
            await postEphemeral(channel, body.user.id, 'You must be an admin', threadTs);
            return;
        }

        if (body.view?.id) {
            await client.views.update({
                view_id: body.view.id,
                view: {
                    type: 'modal',
                    title: { type: 'plain_text', text: 'Slowmode' },
                    close: { type: 'plain_text', text: 'Close' },
                    blocks: [
                        {
                            type: 'section',
                            text: { type: 'mrkdwn', text: '✅ Slowmode has been disabled.' },
                        },
                    ],
                },
            });
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

            await prisma.slowUsers.deleteMany({
                where: {
                    channel: channel,
                    threadTs,
                },
            });

            await logInternal(`<@${body.user.id}> disabled slowmode in a thread in <#${channel}>.`);

            await postMessage(channel, 'Slowmode is disabled in this thread.', threadTs);
        }
    } catch (e) {
        console.error(e);
    }
}

export { slowmodeDisableButton, slowmodeThreadDisableButton };
