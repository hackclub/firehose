import type { App } from '@slack/bolt';
import {
    getPrisma,
    postMessage,
    addReaction,
    logInternal,
    getThreadLink,
    client,
    env,
    isUserAPIAvailable,
    lockMessage,
} from '../../utils/index.js';

function registerModal(app: App) {
    const prisma = getPrisma();

    app.view('lock_modal', async ({ view, ack, body, respond }) => {
        let { thread_id, channel_id } = JSON.parse(view.private_metadata) as {
            thread_id: string;
            channel_id: string;
        };

        const submittedValues = view.state.values;
        let reason: string | undefined;
        let expires: Date | undefined;

        for (let key in submittedValues) {
            if (submittedValues[key]['plain_text_input-action'])
                reason = submittedValues[key]['plain_text_input-action'].value ?? undefined;
            if (submittedValues[key]['datetimepicker-action']) {
                const timestamp = submittedValues[key]['datetimepicker-action'].selected_date_time;
                if (timestamp) {
                    expires = new Date(timestamp * 1000);
                }
            }
        }

        if (!reason) {
            await ack({
                response_action: 'errors',
                errors: {
                    'plain_text_input-action': 'Please provide a reason.',
                },
            });
            return;
        }
        if (!expires) {
            await ack({
                response_action: 'errors',
                errors: {
                    'datetimepicker-action': 'Please provide an expiration time.',
                },
            });
            return;
        }
        if (new Date() > expires) {
            await ack({
                response_action: 'errors',
                errors: {
                    'datetimepicker-action': 'Time cannot be in the past.',
                },
            });
            return;
        }

        ack();

        await Promise.all([
            prisma.log.create({
                data: {
                    thread_id: thread_id,
                    admin: body.user.id,
                    lock_type: 'lock',
                    time: expires,
                    reason,
                    channel: channel_id,
                    active: true,
                },
            }),

            prisma.thread.upsert({
                where: {
                    id: thread_id,
                },
                create: {
                    id: thread_id,
                    admin: body.user.id,
                    lock_type: 'lock',
                    time: expires,
                    reason,
                    channel: channel_id,
                    active: true,
                },
                update: {
                    admin: body.user.id,
                    lock_type: 'lock',
                    time: expires,
                    reason,
                    channel: channel_id,
                    active: true,
                },
            }),
        ]);

        const logMessage = `<@${body.user.id}> locked a thread in <#${channel_id}> until ${expires.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'long' })} EST for ${reason}.\nLink: ${getThreadLink(channel_id, thread_id)}`;

        const [publicLogResult] = await Promise.all([
            client.chat.postMessage({
                channel: env.SLACK_LOG_CHANNEL,
                text: logMessage,
            }),
            logInternal(logMessage),
            postMessage(
                channel_id,
                `This thread is locked until ${expires.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'long' })} EST for ${reason}.`,
                thread_id
            ),
            addReaction(channel_id, 'lock', thread_id),
        ]);

        if (isUserAPIAvailable && publicLogResult?.ts) {
            try {
                await lockMessage(env.SLACK_LOG_CHANNEL, publicLogResult.ts);
            } catch {}
        }
    });
}

export default registerModal;
