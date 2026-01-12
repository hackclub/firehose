const { getPrisma } = require('../utils/prismaConnector');

async function slowmode_thread(args) {
    const { ack, body, client } = args;
    const { user, channel, message, trigger_id } = body;

    await ack();

    const prisma = getPrisma();
    const threadTs = message.thread_ts || message.ts;
    const userInfo = await client.users.info({ user: user.id });
    const isAdmin = userInfo.user.is_admin;

    if (!isAdmin) {
        return await client.chat.postEphemeral({
            channel: `${channel.id}`,
            thread_ts: threadTs,
            user: user.id,
            text: "Only admins can run this command."
        });
    }

    if (!threadTs) {
        return;
    }

    const existingSlowmode = await prisma.Slowmode.findFirst({
        where: {
            channel: channel.id,
            threadTs: threadTs
        }
    });

    const isUpdate = existingSlowmode && existingSlowmode.locked;
    const defaultTime = (existingSlowmode?.time || 5).toString();
    const defaultExpiry = existingSlowmode?.expiresAt
        ? Math.floor(existingSlowmode.expiresAt.getTime() / 1000)
        : undefined;
    const defaultWhitelist = existingSlowmode?.whitelistedUsers || [];

    const slowmodeModal = {
        type: "modal",
        callback_id: "slowmode_thread_modal",
        private_metadata: JSON.stringify({
            channel_id: channel.id,
            admin_id: user.id,
            command_channel: channel.id,
            thread_ts: threadTs,
        }),
        title: {
            type: "plain_text",
            text: isUpdate ? "Update Slowmode" : "Configure Slowmode"
        },
        submit: {
            type: "plain_text",
            text: "Enable"
        },
        close: {
            type: "plain_text",
            text: "Cancel"
        },
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Configure slowmode for this thread`
                }
            },
            {
                type: "input",
                block_id: "slowmode_time_block",
                element: {
                    type: "number_input",
                    is_decimal_allowed: false,
                    action_id: "slowmode_time_input",
                    initial_value: defaultTime,
                    min_value: "1"
                },
                label: {
                    type: "plain_text",
                    text: "Slowmode interval (seconds)"
                },
                hint: {
                    type: "plain_text",
                    text: "Users can send one message every X seconds"
                }
            },
            {
                type: "input",
                block_id: "slowmode_duration_block",
                optional: true,
                element: {
                    type: "datetimepicker",
                    action_id: "slowmode_duration_input",
                    ...(defaultExpiry && { initial_date_time: defaultExpiry })
                },
                label: {
                    type: "plain_text",
                    text: "Slowmode until"
                },
                hint: {
                    type: "plain_text",
                    text: "Leave blank for indefinite"
                }
            },
            {
                type: "input",
                block_id: "slowmode_reason_block",
                optional: true,
                element: {
                    type: "plain_text_input",
                    action_id: "slowmode_reason_input",
                    multiline: false,
                    placeholder: {
                        type: "plain_text",
                        text: "Optional reason"
                    }
                },
                label: {
                    type: "plain_text",
                    text: "Reason"
                }
            },
            {
                type: "input",
                block_id: "slowmode_whitelist_block",
                optional: true,
                element: defaultWhitelist.length > 0 ? {
                    type: "multi_users_select",
                    action_id: "slowmode_whitelist_input",
                    initial_users: defaultWhitelist,
                    placeholder: {
                        type: "plain_text",
                        text: "Select users (admins and channel managers are exempt by default)"
                    }
                } : {
                    type: "multi_users_select",
                    action_id: "slowmode_whitelist_input",
                    placeholder: {
                        type: "plain_text",
                        text: "Select users (admins and channel managers are exempt by default)"
                    }
                },
                label: {
                    type: "plain_text",
                    text: "Whitelisted users"
                },
                hint: {
                    type: "plain_text",
                    text: "These users will be immune to slowmode"
                }
            },
            {
                type: "actions",
                block_id: "slowmode_disable_block",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Turn off Slowmode"
                        },
                        style: "danger",
                        action_id: "slowmode_thread_disable_button",
                        value: JSON.stringify({ channel: channel.id, threadTs: threadTs })
                    }
                ]
            }
        ]
    };

    await client.views.open({
        trigger_id: trigger_id,
        view: slowmodeModal
    })
}

module.exports = slowmode_thread;