import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import type { View } from '@slack/types';
import { getPrisma, isUserAdmin, postEphemeral } from '../../utils/index.js';

async function slowmodeCommand({
    payload: { user_id, text, channel_id, trigger_id },
    client,
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    await ack();
    const prisma = getPrisma();
    const commands = text.split(' ');
    const isAdmin = await isUserAdmin(user_id);

    let channel = channel_id;
    if (commands[0] && commands[0].includes('#')) {
        channel = commands[0].split('|')[0].replace('<#', '').replace('>', '');
    }

    const errors: string[] = [];
    if (!isAdmin) errors.push('Only admins can run this command.');
    if (!channel) errors.push('You need to give a channel to make it read only');

    if (errors.length > 0) return await postEphemeral(channel_id, user_id, errors.join('\n'));

    const existingSlowmode = await prisma.slowmode.findFirst({
        where: { channel: channel, threadTs: '' },
    });

    const isUpdate = existingSlowmode && existingSlowmode.locked;
    const defaultTime = (existingSlowmode?.time || 5).toString();
    const defaultExpiry = existingSlowmode?.expiresAt
        ? Math.floor(existingSlowmode.expiresAt.getTime() / 1000)
        : undefined;
    const defaultWhitelist = existingSlowmode?.whitelistedUsers || [];
    const defaultApplyToThreads = existingSlowmode?.applyToThreads || false;

    const slowmodeModal: View = {
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
                type: 'input',
                block_id: 'slowmode_apply_to_threads_block',
                optional: true,
                element: {
                    type: 'checkboxes',
                    action_id: 'slowmode_apply_to_threads_input',
                    options: [
                        {
                            text: {
                                type: 'plain_text',
                                text: 'Apply to threads',
                            },
                            value: 'apply_to_threads',
                        },
                    ],
                    ...(defaultApplyToThreads && {
                        initial_options: [
                            {
                                text: {
                                    type: 'plain_text',
                                    text: 'Apply to threads',
                                },
                                value: 'apply_to_threads',
                            },
                        ],
                    }),
                },
                label: {
                    type: 'plain_text',
                    text: 'Thread settings',
                },
                hint: {
                    type: 'plain_text',
                    text: 'When enabled, slowmode will also apply to all threads in the channel',
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
    } as View;

    await client.views.open({
        trigger_id: trigger_id,
        view: slowmodeModal,
    });
}

export default slowmodeCommand;
