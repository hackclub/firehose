const chrono = require("chrono-node");
const { getPrisma } = require("../utils/prismaConnector");

async function slowmode(args) {
  const { payload, client } = args;
  const { user_id, text, channel_id } = payload;
  const prisma = getPrisma();
  const commands = text.split(" ");
  const userInfo = await client.users.info({ user: user_id });
  const isAdmin = userInfo.user.is_admin;
  const channel = commands[0].split("|")[0].replace("<#", "");
  let count = Number(commands[1]);
  let time = Number(commands[2]);

  if (!isAdmin) return;

  const createSlowMode = await prisma.Slowmode.create({
    data: {
      channel: channel,
      locked: true,
      time: time,
      messageCount: count,
    },
  });

  // TODO: send message in firehouse logs
  // TODO: cancel slowmode
}

module.exports = slowmode;
