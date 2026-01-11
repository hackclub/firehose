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

    let channel = channel_id;
    if (commands[0] && commands[0].includes('#')) {
        channel = commands[0].split('|')[0].replace("<#", "").replace(">", "");
    }

    const errors = []
    // editor's note: i don't think it would be appropriate allowing channel managers to enable slowmode (for now...) - up to discussion.
    if (!isAdmin) errors.push("Only admins can run this command.");
    if (!channel) errors.push("You need to give a channel to make it read only");

    if (errors.length > 0)
        return await client.chat.postEphemeral({
            channel: `${channel_id}`,
            user: `${user_id}`,
            text: errors.join("\n")
        });

    const existingSlowmode = await prisma.Slowmode.findFirst({
        where: { channel: channel }
    });

    // using a modal-based approach similar to definite threadlocker
    const slowmodeModal = {
        type: "modal",
        callback_id: "slowmode_modal",
        private_metadata: JSON.stringify({
            channel_id: channel,
            admin_id: user_id,
            command_channel: channel_id
        }),
        title: {
            type: "plain_text",
            text: "Configure Slowmode"
        },
        submit: {
            type: "plain_text",
            text: "Update"
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
                    text: `Configure slowmode for <#${channel}>`
                }
            },
            {
                type: "input",
                block_id: "slowmode_time_block",
                element: {
                    type: "number_input",
                    is_decimal_allowed: false,
                    action_id: "slowmode_time_input",
                    initial_value: "5",
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
                    action_id: "slowmode_duration_input"
                },
                label: {
                    type: "plain_text",
                    text: "Slowmode until (optional)"
                },
                hint: {
                    type: "plain_text",
                    text: "Levae blank for indefinite"
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
                    text: "reason"
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
                        action_id: "slowmode_disable_button",
                        value: channel
                    }
                ]
            }
        ]
    };

    await client.views.open({
        trigger_id: payload.trigger_id,
        view: slowmodeModal
    })

    // TODO: cancel slowmode
    }

module.exports = slowmode;