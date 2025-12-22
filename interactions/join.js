async function channelJoin(args) {
  const { client, payload } = args;
  const { user, ts, text, channel, subtype } = payload;
  const prisma = getPrisma();

  try {
    const channelId = event.channel.id;
    await client.conversations.join({ channel: channelId });
  } catch (e) {
    console.log(e);
  }
}

module.exports = channelJoin;
