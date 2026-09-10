import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import type { View } from '@slack/types';
import { isUserAdmin, postEphemeral } from '../../utils/index.js';
import { NUKE_WINDOWS, RETENTION_DAYS } from './windows.js';

const DEFAULT_WINDOW = '24h';

async function nukeCommand({
    payload: { user_id, text, channel_id, trigger_id },
    client,
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();

    const isAdmin = await isUserAdmin(user_id);
    if (!isAdmin) {
        await postEphemeral(channel_id, user_id, ':x: Only admins can run this command.');
        return;
    }

    const target = text.trim().match(/<@([A-Z0-9]+)\|?.*>/)?.[1];

    const windowOptions = NUKE_WINDOWS.map((w) => ({
        text: { type: 'plain_text' as const, text: w.label },
        value: w.value,
    }));
    const initialWindow = windowOptions.find((o) => o.value === DEFAULT_WINDOW) ?? windowOptions[0];

    const view: View = {
        type: 'modal',
        callback_id: 'nuke_modal',
        private_metadata: JSON.stringify({ admin_id: user_id, command_channel: channel_id }),
        title: { type: 'plain_text', text: 'Nuke messages' },
        submit: { type: 'plain_text', text: 'Preview' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
            {
                type: 'input',
                block_id: 'nuke_user_block',
                element: {
                    type: 'users_select',
                    action_id: 'nuke_user_input',
                    ...(target && { initial_user: target }),
                    placeholder: { type: 'plain_text', text: 'Select a user' },
                },
                label: { type: 'plain_text', text: 'User' },
            },
            {
                type: 'input',
                block_id: 'nuke_window_block',
                element: {
                    type: 'static_select',
                    action_id: 'nuke_window_input',
                    options: windowOptions,
                    initial_option: initialWindow,
                },
                label: { type: 'plain_text', text: 'Delete messages from' },
                hint: {
                    type: 'plain_text',
                    text: `Only the last ${RETENTION_DAYS} days are indexed.`,
                },
            },
            {
                type: 'input',
                block_id: 'nuke_reason_block',
                optional: true,
                element: {
                    type: 'plain_text_input',
                    action_id: 'nuke_reason_input',
                    placeholder: { type: 'plain_text', text: 'Optional reason' },
                },
                label: { type: 'plain_text', text: 'Reason' },
            },
        ],
    } as View;

    await client.views.open({ trigger_id, view });
}

export default nukeCommand;
