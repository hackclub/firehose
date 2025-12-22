const { PrismaClient } = require("@prisma/client");
const { getPrisma } = require("../utils/prismaConnector");
const getChannelManagers = require("../utils/isChannelManger");
require("dotenv").config();

async function whitelist(args) {
  const { payload, client, logger } = args;
  const { text, channel_id, user_id } = payload;
  const prisma = getPrisma();
  const commands = text.split(" ");
  const userInfo = await client.users.info({ user: user_id });
  const channel = commands[1].split("|")[0].replace("<#", "");
  const userToAdd = commands[0].split("|")[0].replace("<@", "");
  const isAdmin = (await userInfo).user.is_admin;
  const channelManagers = await getChannelManagers(channel_id);
  console.info(channelManagers);

  const errors = [];
  if (!isAdmin && !channelManagers.includes(user_id))
    errors.push("Only admins can run this command.");
  if (!channel) errors.push("You need to give a channel to make it read only");
  if (!userToAdd) errors.push("You need to give a user to make it read only");

  if (errors.length > 0)
    return await client.chat.postEphemeral({
      channel: `${channel_id}`,
      user: `${user_id}`,
      text: errors.join("\n"),
    });

  const getChannel = await prisma.Channel.findFirst({
    where: {
      id: channel,
      readOnly: true,
    },
  });

  console.log(getChannel);
  if (getChannel) {
    console.log("this is whitelisting");
    console.log("I am trying");
    try {
      await prisma.Channel.update({
        where: {
          id: channel,
        },
        data: {
          allowlist: {
            push: userToAdd,
          },
        },
      });
    } catch (e) {
      console.log("Error:", e);
    }
    const finalResult = await prisma.Channel.findFirst({
      where: {
        id: channel,
        readOnly: true,
      },
    });

    console.log("I did it");
    console.log(`Added ${userToAdd} to ${channel}:`, finalResult);

    try {
      await client.chat.postMessage({
        channel: process.env.MIRRORCHANNEL,
        text: `<@${user_id}> added <@${userToAdd}> to the whitelist for <#${channel}>`,
      });
    } catch (e) {
      console.error(e);
    }
  }
}

module.exports = whitelist;
