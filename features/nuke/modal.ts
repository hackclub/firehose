import type { App } from '@slack/bolt';
import type { View } from '@slack/types';
import { isUserAdmin, postEphemeral } from '../../utils/index.js';
import { getWindow, RETENTION_DAYS } from './windows.js';
import { collectTargets, countThreadParents, runNuke } from './run.js';

type ConfirmMetadata = {
    admin_id: string;
    command_channel: string;
    target: string;
    window: string;
    reason: string;
};

function registerModal(app: App) {
    app.view('nuke_modal', async ({ view, ack, body }) => {
        const { admin_id, command_channel } = JSON.parse(view.private_metadata) as {
            admin_id: string;
            command_channel: string;
        };
        const values = view.state.values as Record<string, Record<string, any>>;
        const target = values.nuke_user_block.nuke_user_input.selected_user as string;
        const windowValue = values.nuke_window_block.nuke_window_input.selected_option
            ?.value as string;
        const reason = (values.nuke_reason_block?.nuke_reason_input?.value as string) || '';

        const selected = getWindow(windowValue);
        if (!selected) {
            await ack({
                response_action: 'errors',
                errors: { nuke_window_block: 'Unknown time window.' },
            });
            return;
        }

        if (target === body.user.id) {
            await ack({
                response_action: 'errors',
                errors: { nuke_user_block: 'You cannot nuke your own messages.' },
            });
            return;
        }

        if (await isUserAdmin(target)) {
            await ack({
                response_action: 'errors',
                errors: { nuke_user_block: 'You cannot nuke a workspace admin.' },
            });
            return;
        }

        const since = new Date(Date.now() - selected.ms);
        const targets = await collectTargets(target, since);
        const total = targets.reduce((sum, t) => sum + t.timestamps.length, 0);

        if (total === 0) {
            await ack({
                response_action: 'errors',
                errors: {
                    nuke_window_block: `No indexed messages from that user in this window.`,
                },
            });
            return;
        }

        const threadParents = await countThreadParents(targets);
        const metadata: ConfirmMetadata = {
            admin_id,
            command_channel,
            target,
            window: windowValue,
            reason,
        };

        const lines = [
            `*${total}* message${total === 1 ? '' : 's'} from <@${target}> across *${targets.length}* channel${targets.length === 1 ? '' : 's'}.`,
            `Window: *${selected.label}*`,
            `Reason: ${reason || '_(none provided)_'}`,
        ];
        if (threadParents > 0) {
            lines.push(
                `:warning: ${threadParents} of these start${threadParents === 1 ? 's' : ''} a thread. Replies from other people are left in place — use *Destroy thread* if the whole thread should go.`
            );
        }
        lines.push('*This cannot be undone.*');

        const confirmView: View = {
            type: 'modal',
            callback_id: 'nuke_confirm_modal',
            private_metadata: JSON.stringify(metadata),
            title: { type: 'plain_text', text: 'Confirm nuke' },
            submit: { type: 'plain_text', text: 'Delete them' },
            close: { type: 'plain_text', text: 'Cancel' },
            blocks: [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: lines.join('\n') },
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `Only messages indexed in the last ${RETENTION_DAYS} days can be deleted this way.`,
                        },
                    ],
                },
            ],
        } as View;

        await ack({ response_action: 'update', view: confirmView });
    });

    app.view('nuke_confirm_modal', async ({ view, ack, body }) => {
        ack();

        const { admin_id, command_channel, target, window, reason } = JSON.parse(
            view.private_metadata
        ) as ConfirmMetadata;

        const selected = getWindow(window);
        if (!selected) return;

        const admin = body.user.id || admin_id;
        if (!(await isUserAdmin(admin))) return;

        const since = new Date(Date.now() - selected.ms);
        const targets = await collectTargets(target, since);
        const total = targets.reduce((sum, t) => sum + t.timestamps.length, 0);

        if (total === 0) {
            await postEphemeral(
                command_channel,
                admin,
                `:x: No messages from <@${target}> left to delete in that window.`
            );
            return;
        }

        try {
            await postEphemeral(
                command_channel,
                admin,
                `:hammer: Deleting \`${total}\` messages from <@${target}> across \`${targets.length}\` channels. Progress is in the log channel.`
            );
        } catch (e) {
            console.error('[nuke] could not notify admin:', e);
        }

        await runNuke(targets, target, admin, selected.label, reason);
    });
}

export default registerModal;
