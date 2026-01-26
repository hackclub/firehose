import type { App } from '@slack/bolt';
import { getPrisma, postMessage, addReaction, logBoth, getThreadLink } from '../../utils/index.js';

function registerModal(app: App) {
    const prisma = getPrisma();

    app.view('lock_modal', async ({ view, ack, body, respond }) => {
        let json: { thread_id: string; channel_id: string };
        try {
            json = JSON.parse(view.private_metadata);
        } catch (e) {
            await ack();
            return respond('Something bad happened. Likely more than one instance is running.');
        }
        const thread_id = json.thread_id;
        const channel_id = json.channel_id;

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
            return await ack({
                response_action: 'errors',
                errors: {
                    'plain_text_input-action': 'Please provide a reason.',
                },
            });
        }
        if (!expires) {
            return await ack({
                response_action: 'errors',
                errors: {
                    'datetimepicker-action': 'Please provide an expiration time.',
                },
            });
        }
        if (new Date() > expires) {
            return await ack({
                response_action: 'errors',
                errors: {
                    'datetimepicker-action': 'Time cannot be in the past.',
                },
            });
        }

        await ack();

        const thread = await prisma.thread.findFirst({
            where: {
                id: thread_id,
            },
        });

        await prisma.log.create({
            data: {
                thread_id: thread_id,
                admin: body.user.id,
                lock_type: 'lock',
                time: expires,
                reason,
                channel: channel_id,
                active: true,
            },
        });

        if (!thread) {
            await prisma.thread.create({
                data: {
                    id: thread_id,
                    admin: body.user.id,
                    lock_type: 'test',
                    time: expires,
                    reason,
                    channel: channel_id,
                    active: true,
                },
            });
        } else {
            await prisma.thread.update({
                where: {
                    id: thread_id,
                },
                data: {
                    id: thread_id,
                    admin: body.user.id,
                    lock_type: 'test',
                    time: expires,
                    reason,
                    channel: channel_id,
                    active: true,
                },
            });
        }

        await postMessage(
            channel_id,
            `🔒 Thread locked. Reason: ${reason} (until: ${expires.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'long' })} EST)`,
            thread_id
        );

        await logBoth(
            `🔒 Thread locked in <#${channel_id}>
Reason: ${reason}
Expires: ${expires.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: 'short', dateStyle: 'long' })} (EST)
Link: ${getThreadLink(channel_id, thread_id)}`
        );

        try {
            await addReaction(channel_id, 'lock', thread_id);
        } catch (e) {}
    });
}

export default registerModal;
