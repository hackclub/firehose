const { getPrisma, postMessage, getThreadLink, logInternal } = require('../../utils');

/** @param {import('@slack/bolt').SlackViewMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmodeModal(args) {
    const { ack, body } = args;
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
        /** @type {{ value: string }[]} */
        const applyToThreadsOptions =
            submittedValues.slowmode_apply_to_threads_block?.slowmode_apply_to_threads_input
                ?.selected_options || [];
        const applyToThreads = applyToThreadsOptions.some(
            (opt) => opt.value === 'apply_to_threads'
        );
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

        await prisma.slowmode.upsert({
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
                applyToThreads: applyToThreads,
            },
            update: {
                locked: true,
                time: slowmodeTime,
                expiresAt: expiresAt,
                reason: reason,
                admin: admin_id,
                whitelistedUsers: whitelistedUsers,
                applyToThreads: applyToThreads,
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
        const threadText = applyToThreads ? ' (including threads)' : '';

        await logInternal(
            `<@${admin_id}> enabled a ${slowmodeTime} second Slowmode in <#${channel_id}>${threadText} for ${reasonText} ${expiryText}`
        );

        await postMessage(
            channel_id,
            `A ${slowmodeTime} second Slowmode has been enabled in this channel${threadText} ${expiryText}`
        );
    } catch (e) {
        console.error(e);
    }
}

/** @param {import('@slack/bolt').SlackViewMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmodeThreadModal(args) {
    const { ack, body } = args;
    const prisma = getPrisma();

    try {
        const view = body.view;
        const metadata = JSON.parse(view.private_metadata);
        const { channel_id, admin_id, command_channel, thread_ts } = metadata;
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

        await prisma.slowmode.upsert({
            where: {
                channel_threadTs: {
                    channel: channel_id,
                    threadTs: thread_ts,
                },
            },
            create: {
                channel: channel_id,
                threadTs: thread_ts,
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
                    threadTs: thread_ts,
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
                            threadTs: thread_ts,
                            user: userId,
                        },
                    },
                    create: {
                        channel: channel_id,
                        threadTs: thread_ts,
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

        await logInternal(
            `<@${admin_id}> enabled a ${slowmodeTime} second Slowmode in ${getThreadLink(channel_id, thread_ts)} for ${reasonText} ${expiryText}`
        );

        await postMessage(
            channel_id,
            `A ${slowmodeTime} second Slowmode has been enabled in this thread ${expiryText}`,
            thread_ts
        );
    } catch (e) {
        console.error(e);
    }
}

module.exports = {
    slowmodeModal,
    slowmodeThreadModal,
};
