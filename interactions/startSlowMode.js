const { getPrisma } = require("../utils/prismaConnector");
require("dotenv").config();

async function startSlowMode(args) {
  const { client, payload } = args;
  const { user, ts, text, channel, subtype } = payload;
  const prisma = getPrisma();

  const getSlowmode = await prisma.Slowmode.findFirst({
    where: {
      channel: channel,
    },
  });
  if (!getSlowmode) return;

  await client.chat.postMessage({
    channel: channel,
    text: "Slow mode is in progress!",
  });

  const createUser = await prisma.SlowUsers.upsert({
    where: {
      channel_user: {
        // Use the composite unique constraint
        channel: channel,
        user: user,
      },
    },
    create: {
      channel: channel,
      user: user,
      count: 0,
    },
    update: {
      count: { increment: 1 },
    },
  });

  const userData = await prisma.SlowUsers.findFirst({
    where: {
      channel: channel,
      user: user,
    },
  });

  console.log(userData);
  await client.chat.postMessage({
    channel: channel,
    text: "test",
  });
}

module.exports = startSlowMode;
