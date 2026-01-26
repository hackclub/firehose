const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackViewMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmode_modal(args) {
    const { ack, body, client } = args;
    const prisma = getPrisma();

    try {
        const view = body.view;
        const metadata = JSON.parse(view.private_metadata);
        const { channel_id, admin_id, command_channel } = metadata;
        const submittedValues = /** @type {Record<string, Record<string, any>>} */ (
            view.state.values
        );
        const slowmodeTime = parseInt(
            submittedValues.slowmode_time_block.slowmode_time_input.value || '0'
        );
        const slowmodeDuration =
            submittedValues.slowmode_duration_block.slowmode_duration_input.selected_date_time;
        const reason = submittedValues.slowmode_reason_block.slowmode_reason_input.value || '';
        /** @type {string[]} */
        const whitelistedUsers =
            submittedValues.slowmode_whitelist_block.slowmode_whitelist_input.selected_users || [];
        /** @type {Record<string, string>} */
        const errors = {};

        let expiresAt = null;
        if (slowmodeDuration) {
            expiresAt = new Date(slowmodeDuration * 1000);
            if (expiresAt <= new Date()) {
                errors.slowmode_duration_block = 'Time cannot be in the past.';
            }
        }
        if (slowmodeTime < 1) {
            errors.slowmode_time_block = 'Invalid slowmode interval';
        }

        if (Object.keys(errors).length > 0) {
            return await ack({
                response_action: 'errors',
                errors: errors,
            });
        }

        await ack();

        const slowmode = await prisma.slowmode.upsert({
            where: {
                channel_threadTs: {
                    channel: channel_id,
                    threadTs: '',
                },
            },
            create: {
                channel: channel_id,
                threadTs: '',
                locked: true,
                time: slowmodeTime,
                expiresAt: expiresAt,
                reason: reason,
                admin: admin_id,
                whitelistedUsers: whitelistedUsers,
            },
            update: {
                locked: true,
                time: slowmodeTime,
                expiresAt: expiresAt,
                reason: reason,
                admin: admin_id,
                whitelistedUsers: whitelistedUsers,
                updatedAt: new Date(),
            },
        });

        await prisma.$transaction([
            prisma.slowUsers.updateMany({
                where: {
                    channel: channel_id,
                    threadTs: '',
                    whitelist: true,
                    user: { notIn: whitelistedUsers },
                },
                data: { whitelist: false },
            }),
            ...whitelistedUsers.map((userId) =>
                prisma.slowUsers.upsert({
                    where: {
                        channel_threadTs_user: {
                            channel: channel_id,
                            threadTs: '',
                            user: userId,
                        },
                    },
                    create: {
                        channel: channel_id,
                        threadTs: '',
                        user: userId,
                        whitelist: true,
                        lastMessageAt: 0,
                    },
                    update: { whitelist: true },
                })
            ),
        ]);

        const expiryText = expiresAt
            ? `until ${expiresAt.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'long' })} EST`
            : 'indefinitely';

        const reasonText = reason ? `${reason}` : '(none provided)';

        await client.chat.postMessage({
            channel: env.MIRRORCHANNEL,
            text: `<@${admin_id}> enabled a ${slowmodeTime} second Slowmode in <#${channel_id}> for ${reasonText} ${expiryText}`,
        });

        await client.chat.postMessage({
            channel: channel_id,
            text: `A ${slowmodeTime} second Slowmode has been enabled in this channel ${expiryText}`,
        });
    } catch (e) {
        console.error(e);
    }
}

module.exports = slowmode_modal;
