const { getPrisma } = require('../utils/prismaConnector');
const getChannelManagers = require('../utils/isChannelManager');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function slowmode(args) {
    const { payload, client } = args;
    const { user_id, text, channel_id } = payload;
    const prisma = getPrisma();
    const commands = text.split(' ');
    const userInfo = await client.users.info({ user: user_id });
    const isAdmin = userInfo.user?.is_admin;
    const channelManagers = await getChannelManagers(channel_id);

    let channel = channel_id;
    if (commands[0] && commands[0].includes('#')) {
        channel = commands[0].split('|')[0].replace('<#', '').replace('>', '');
    }

    const errors = [];
    // editor's note: i don't think it would be appropriate allowing channel managers to enable slowmode (for now...) - up to discussion.
    if (!isAdmin) errors.push('Only admins can run this command.');
    if (!channel) errors.push('You need to give a channel to make it read only');

    if (errors.length > 0)
        return await client.chat.postEphemeral({
            channel: `${channel_id}`,
            user: `${user_id}`,
            text: errors.join('\n'),
        });

    const existingSlowmode = await prisma.slowmode.findFirst({
        where: { channel: channel },
    });

    const isUpdate = existingSlowmode && existingSlowmode.locked;
    const defaultTime = (existingSlowmode?.time || 5).toString();
    const defaultExpiry = existingSlowmode?.expiresAt
        ? Math.floor(existingSlowmode.expiresAt.getTime() / 1000)
        : undefined;
    const defaultWhitelist = existingSlowmode?.whitelistedUsers || [];

    // using a modal-based approach similar to definite threadlocker
    /** @type {import('@slack/types').View} */
    const slowmodeModal = /** @type {any} */ ({
        type: 'modal',
        callback_id: 'slowmode_modal',
        private_metadata: JSON.stringify({
            channel_id: channel,
            admin_id: user_id,
            command_channel: channel_id,
        }),
        title: {
            type: 'plain_text',
            text: isUpdate ? 'Update Slowmode' : 'Configure Slowmode',
        },
        submit: {
            type: 'plain_text',
            text: 'Enable',
        },
        close: {
            type: 'plain_text',
            text: 'Cancel',
        },
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `Configure slowmode for <#${channel}>`,
                },
            },
            {
                type: 'input',
                block_id: 'slowmode_time_block',
                element: {
                    type: 'number_input',
                    is_decimal_allowed: false,
                    action_id: 'slowmode_time_input',
                    initial_value: defaultTime,
                    min_value: '1',
                },
                label: {
                    type: 'plain_text',
                    text: 'Slowmode interval (seconds)',
                },
                hint: {
                    type: 'plain_text',
                    text: 'Users can send one message every X seconds',
                },
            },
            {
                type: 'input',
                block_id: 'slowmode_duration_block',
                optional: true,
                element: {
                    type: 'datetimepicker',
                    action_id: 'slowmode_duration_input',
                    ...(defaultExpiry && { initial_date_time: defaultExpiry }),
                },
                label: {
                    type: 'plain_text',
                    text: 'Slowmode until',
                },
                hint: {
                    type: 'plain_text',
                    text: 'Leave blank for indefinite',
                },
            },
            {
                type: 'input',
                block_id: 'slowmode_reason_block',
                optional: true,
                element: {
                    type: 'plain_text_input',
                    action_id: 'slowmode_reason_input',
                    multiline: false,
                    placeholder: {
                        type: 'plain_text',
                        text: 'Optional reason',
                    },
                },
                label: {
                    type: 'plain_text',
                    text: 'Reason',
                },
            },
            {
                type: 'input',
                block_id: 'slowmode_whitelist_block',
                optional: true,
                element:
                    defaultWhitelist.length > 0
                        ? {
                              type: 'multi_users_select',
                              action_id: 'slowmode_whitelist_input',
                              initial_users: defaultWhitelist,
                              placeholder: {
                                  type: 'plain_text',
                                  text: 'Select users (admins and channel managers are exempt by default)',
                              },
                          }
                        : {
                              type: 'multi_users_select',
                              action_id: 'slowmode_whitelist_input',
                              placeholder: {
                                  type: 'plain_text',
                                  text: 'Select users (admins and channel managers are exempt by default)',
                              },
                          },
                label: {
                    type: 'plain_text',
                    text: 'Whitelisted users',
                },
                hint: {
                    type: 'plain_text',
                    text: 'These users will be immune to slowmode',
                },
            },
            {
                type: 'actions',
                block_id: 'slowmode_disable_block',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'Turn off Slowmode',
                        },
                        style: 'danger',
                        action_id: 'slowmode_disable_button',
                        value: JSON.stringify({ channel: channel, threadTs: '' }),
                    },
                ],
            },
        ],
    });

    await client.views.open({
        trigger_id: payload.trigger_id,
        view: slowmodeModal,
    });
}

module.exports = slowmode;
