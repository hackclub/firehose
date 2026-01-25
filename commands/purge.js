const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackCommandMiddlewareArgs & import('@slack/bolt').AllMiddlewareArgs} args */
async function purge(args) {
    const { payload, client, respond } = args;
    const { user_id, text, channel_id } = payload;
    const commands = text.split(' ');
    const userInfo = await client.users.info({ user: user_id });
    const isAdmin = userInfo.user?.is_admin;
    if (!isAdmin) return;
    if (commands.length < 1)
        return respond(`:x: You need to specify a number of messages to purge. :P`);

    let amount = parseInt(commands[0]);
    if (isNaN(amount)) return respond(`:x: You need to specify a number of messages to purge.`);
    if (amount < 0 || amount > 100)
        return respond(
            `:x: You need to specify a valid number of messages to purge. (must be under 100 and above 0)`
        );
    const userId = commands[1];
    if (userId) {
        const user = await client.users
            .info({ user: userId })
            .catch(() => /** @type {{ ok: false, user?: undefined }} */ ({ ok: false }));
        if (!user.ok) return respond(`:x: User \`${userId}\` does not exist.`);
        if (user.user?.is_admin)
            return respond(
                `:x: User <@${userId}> is an admin. Cannot directly purge messages from admin.`
            );
    }

    const stamp = Date.now();
    const purgeMessage = await client.chat.postMessage({
        text: `:spin-loading: Purging \`${amount}\` messages ${
            userId ? `from user <@${userId}>` : ''
        }`,
        channel: channel_id,
    });
    const currentMessages = await client.conversations.history({
        channel: channel_id,
        limit: amount + 1,
    });

    const messagesToDelete = (currentMessages.messages ?? [])
        .filter((msg) => {
            if (!msg.ts) return false;
            if (msg.ts === purgeMessage.ts) return false;
            if (userId && msg.user !== userId) return false;
            return true;
        })
        .slice(0, amount);

    let deleted = 0;
    let failed = 0;
    for (const msg of messagesToDelete) {
        try {
            if (!msg.ts) throw new Error('Message missing ts'); // should not happen
            await client.chat.delete({
                token: env.SLACK_USER_TOKEN,
                channel: channel_id,
                ts: msg.ts,
            });
            deleted++;
        } catch (e) {
            failed++;
            console.error(`Failed to delete message ${msg.ts}:`, e);
        }
    }

    if (!purgeMessage.ts) return;
    const elapsed = Math.floor((Date.now() - stamp) / 1000);
    await Promise.all([
        client.chat.update({
            channel: channel_id,
            ts: purgeMessage.ts,
            text: `:white_check_mark: Purged \`${deleted}/${messagesToDelete.length}\` messages${
                userId ? ` from <@${userId}>` : ''
            }${failed ? ` (${failed} failed)` : ''} in \`${elapsed}s\``,
        }),
        client.chat.postMessage({
            channel: env.MIRRORCHANNEL,
            text: `<@${user_id}> purged \`${deleted}/${messagesToDelete.length}\` messages${
                userId ? ` from <@${userId}>` : ''
            }${failed ? ` (${failed} failed)` : ''} in \`${elapsed}s\``,
        }),
    ]);
}

module.exports = purge;
