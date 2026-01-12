// this is virtually the same as slowmode_modal.js
const { getPrisma } = require('../utils/prismaConnector');
require('dotenv').config();

async function slowmode_thread_modal(args) {
    const { ack, body, client } = args;
    const prisma = getPrisma();

    try {
        const view = body.view;
        const metadata = JSON.parse(view.private_metadata);
        const { channel_id, admin_id, command_channel, thread_ts } = metadata;
        const submittedValues = view.state.values;
        const slowmodeTime = parseInt(submittedValues.slowmode_time_block.slowmode_time_input.value);
        const slowmodeDuration = submittedValues.slowmode_duration_block.slowmode_duration_input.selected_date_time;
        const reason = submittedValues.slowmode_reason_block.slowmode_reason_input.value || "";
        const whitelistedUsers = submittedValues.slowmode_whitelist_block.slowmode_whitelist_input.selected_users || [];
        const errors = {};

        let expiresAt = null;
        if (slowmodeDuration) {
            expiresAt = new Date(slowmodeDuration * 1000);
            if (expiresAt <= new Date()) {
                errors.slowmode_duration_block = "Time cannot be in the past.";
            }
        }
        if (slowmodeTime < 1) {
            errors.slowmode_time_block = "Invalid slowmode interval";
        }

        if (Object.keys(errors).length > 0) {
            return await ack({
                response_action: "errors",
                errors: errors
            });
        }

        await ack();

        const slowmode = await prisma.Slowmode.upsert({
            where: {
                channel_threadTs: {
                    channel: channel_id,
                    threadTs: thread_ts
                }
            },
            create: {
                channel: channel_id,
                threadTs: thread_ts,
                locked: true,
                time: slowmodeTime,
                expiresAt: expiresAt,
                reason: reason,
                admin: admin_id,
                whitelistedUsers: whitelistedUsers
            },
            update: {
                locked: true,
                time: slowmodeTime,
                expiresAt: expiresAt,
                reason: reason,
                admin: admin_id,
                whitelistedUsers: whitelistedUsers,
                updatedAt: new Date()
            }
        });

        for (const userId of whitelistedUsers) {
            await prisma.SlowUsers.upsert({
                where: {
                    channel_threadTs_user: {
                        channel: channel_id,
                        threadTs: thread_ts,
                        user: userId
                    }
                },
                create: {
                    channel: channel_id,
                    threadTs: thread_ts,
                    user: userId,
                    whitelist: true,
                    count: 0
                },
                update: {
                    whitelist: true,
                }
            });
        }

        const allWhitelistedSlowUsers = await prisma.SlowUsers.findMany({
            where: {
                channel: channel_id,
                threadTs: thread_ts,
                whitelist: true
            }
        });

        for (const slowUser of allWhitelistedSlowUsers) {
            if (!whitelistedUsers.includes(slowUser.user)) {
                await prisma.SlowUsers.update({
                    where: {
                        channel_threadTs_user: {
                            channel: channel_id,
                            threadTs: thread_ts,
                            user: slowUser.user
                        }
                    },
                    data: {
                        whitelist: false
                    }
                });
            }
        }

        const expiryText = expiresAt
            ? `until ${expiresAt.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: "short", dateStyle: "long" })} EST`
            : "indefinitely"

        const reasonText = reason ? `${reason}` : "(none provided)";

        await client.chat.postMessage({
            channel: process.env.MIRRORCHANNEL,
            text: `<@${admin_id}> enabled a ${slowmodeTime} second Slowmode in https://hackclub.slack.com/archives/${channel_id}/p${thread_ts.toString().replace(".", "")} for ${reasonText} ${expiryText}`
        });

        await client.chat.postMessage({
            channel: channel_id,
            thread_ts,
            text: `A ${slowmodeTime} second Slowmode has been enabled in this thread ${expiryText}`
        });
    } catch(e) {
        console.error(e);
    }
}

module.exports = slowmode_thread_modal;
