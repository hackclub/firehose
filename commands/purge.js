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
                `:x: User <@${userId}> is  an admin. Cannot directly purge messages from admin.`
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
        limit: amount || 100,
    });
    let cleared_messages = 0;
    for (const msg of currentMessages.messages ?? []) {
        if (userId) {
            if (msg.user !== userId) continue;
        }
        if (cleared_messages >= amount) break;
        if (msg.ts === purgeMessage.ts) continue;
        if (!msg.ts) continue;
        try {
            await client.chat.delete({
                channel: channel_id,
                ts: msg.ts,
            });
            cleared_messages++;
        } catch (e) {
            console.error(e);
        }
    }
    if (!purgeMessage.ts) return;
    await Promise.all([
        client.chat.postMessage({
            channel: channel_id,
            reply_broadcast: true,
            thread_ts: purgeMessage.ts,
            text: `:white_check_mark: Purged \`${cleared_messages}\` messages ${
                userId ? `from user <@${userId}>` : ''
            }\nTook \`${Math.floor((Date.now() - stamp) / 1000)}s\``,
        }),
        client.chat.postMessage({
            channel: env.MIRRORCHANNEL,
            text: `<@${user_id}> requested to purge \`${amount}\` messages ${
                userId ? `from <@${userId}>` : ''
            }\n\`${cleared_messages}\` messages were removed correctly, Took \`${Math.floor(
                (Date.now() - stamp) / 1000
            )}s\`. `,
        }),
    ]);
}

module.exports = purge;
