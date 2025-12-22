async function purge(args) {
  const { payload, client, respond } = args;
  const { user_id, text } = payload;
  //   const prisma = getPrisma();
  const commands = text.split(" ");
  const userInfo = await client.users.info({ user: user_id });
  const isAdmin = userInfo.user.is_admin;
  if (!isAdmin) return;
  if (commands.length < 1)
    return respond(`:x: You need to specify a number of messages to purge. :P`);

  let amount = commands[0];
  if (isNaN(amount))
    return respond(`:x: You need to specify a number of messages to purge.`);
  amount = parseInt(amount);
  if (amount < 0 || amount > 100)
    return respond(
      `:x: You need to specify a valid number of messages to purge. (must be under 100 and above 0)`,
    );
  const userId = commands[1];
  if (userId) {
    // check if user exists
    const user = await client.users
      .info({ user: userId })
      .catch((e) => ({ ok: false }));
    if (!user.ok) return respond(`:x: User \`${userId}\` does not exist.`);
    // check if users are admin
    if (user.user.is_admin)
      return respond(
        `:x: User <@${userId}> is  an admin. Cannot directly purge messages from admin.`,
      );
  }

  const purgeMessage = await client.chat.postMessage({
    text: `:spin-loading: Purging \`${amount}\` messages ${
      userId ? `from user <@${userId}>` : ""
    }`,
    channel: args.channel_id,
  });
  const currentMessages = await client.conversations.history({
    channel: args.channel_id,
    count: amount || 100,
  });
  let cleared_messages = 0;
  for (const msg of currentMessages.messages) {
    if (userId) {
      if (msg.user !== userId) continue;
    }
    if (cleared_messages >= amount) break;
    if (msg.ts === purgeMessage.ts) continue;
    try {
      await client.chat.delete({
        channel: args.channel_id,
        ts: msg.ts,
      });
      cleared_messages++;
    } catch (e) {
      console.error(e);
    }
  }
  await Promise.all([
    client.chat.postMessage({
      channel: args.channel_id,
      reply_broadcast: true,
      thread_ts: purgeMessage.ts,
      text: `:white_check_mark: Purged \`${cleared_messages}\` messages ${
        userId ? `from user <@${userId}>` : ""
      }\nTook \`${Math.floor((Date.now() - stamp) / 1000)}s\``,
    }),
    client.chat.postMessage({
      channel: process.env.MIRRORCHANNEL,
      text: `<@${user_id}> requested to purge \`${amount}\` messages ${
        userId ? `from <@${userId}>` : ""
      }\n\`${cleared_messages}\` messages were removed correctly, Took \`${Math.floor(
        (Date.now() - stamp) / 1000,
      )}s\`. `,
    }),
  ]);
}

module.exports = purge;
