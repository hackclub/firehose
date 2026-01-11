const { getPrisma } = require('../utils/prismaConnector');
require('dotenv').config();

async function slowmode_modal(args) {
    const { ack, body, client } = args;
    const prisma = getPrisma();

    try {
        const view = body.view;
        const metadata = JSON.parse(view.privateMetaData);
        const { channel_id, admin_id, command_channel } = metadata;
        const submittedValues = view.state.values;
        const slowmodeTime = parseInt(submittedValues.slowmode_time_block.slowmode_time_input.value);
        const slowmodeDuration = submittedValues.slowmode_duration_block.slowmode_duration_input.selected_date_time;
        const reason = submittedValues.slowmode_reason_block.slowmode_reason_input.value || "";

        let expiresAt = null;
        if (slowmodeDuration) {
            expiresAt = new Date(slowmodeDuration * 1000);
            if (expiresAt <= new Date()) {
                return await ack({
                    response_action: "errors",
                    errors: {
                        slowmode_duration_block: "Time cannot be in the past"
                    }
                });
            }
        }
        await ack();

        await prisma.Slowmode.create({
            data: {
                channel: channel_id,
                locked: true,
                time: slowmodeTime,
                expiresAt: expiresAt,
                reason: reason,
                admin: admin_id
            }
        });

        // TODO: update current slowmode
        // TODO: cancel slowmode

        const expiryText = expiresAt
            ? `until ${expiresAt.toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: "short", dateStyle: "long" })} EST`
            : "indefinitely"

        const reasonText = reason ? `\nReason: ${reason}` : "(none provided)";

        await client.chat.postMessage({
            channel: process.env.MIRRORCHANNEL,
            text: `<@${admin_id}> enabled a ${slowmodeTime} second Slowmode in <#${channel_id}> for {reasonText} until ${expiryText}`
        });

        await client.chat.postMessage({
            channel: channel_id,
            text: `A ${slowmodeTime} second Slowmode has been enabled in this channel until ${expiryText}`
        });
    } catch(e) {
        console.error(e);
        await ack();
    }
}

module.exports = slowmode_modal;
