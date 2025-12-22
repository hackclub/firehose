const { getPrisma } = require("../utils/prismaConnector");
const chrono = require("chrono-node");

async function shushBan(args) {
  const { payload, client } = args;
  const { user_id, text, channel_id } = payload;
  const prisma = getPrisma();

  const userInfo = await client.users.info({ user: user_id });
  const isAdmin = userInfo.user.is_admin;
  const commands = text.split(" ");
  const userToBan = commands[0].split("|")[0].replace("<@", "");

  // Parse time if "for" keyword is present
  let expirationTime = null;
  let reason = "";
  const textAfterUser = commands.slice(1).join(" ");
  const forIndex = textAfterUser.toLowerCase().lastIndexOf(" for ");

  if (forIndex !== -1) {
    reason = textAfterUser.substring(0, forIndex);
    const timeString = textAfterUser.substring(forIndex + 5); // +5 to skip " for "
    const parsedTime = chrono.parse(timeString);
    if (parsedTime.length > 0) {
      expirationTime = parsedTime[0].start.date();
    }
  } else {
    reason = textAfterUser;
  }

  // // const userProfile = await client.users.profile.get({ user: userToBan });
  // const profilePhoto = userProfile.profile.image_512;
  // const displayName = userProfile.profile.display_name;

  const errors = [];
  if (!isAdmin) errors.push("Non-admins can only shush themselves.");
  if (!reason) errors.push("A reason is required.");
  if (!userToBan) errors.push("A user is required");
  if (expirationTime && expirationTime < new Date()) {
    errors.push("Expiration time must be in the future.");
  }

  if (errors.length > 0)
    return await client.chat.postEphemeral({
      channel: channel_id,
      user: `${user_id}`,
      text: errors.join("\n"),
    });

  try {
    if (isAdmin) {
      const timeMessage = expirationTime
        ? ` until ${expirationTime.toLocaleString("en-US", { timeZone: "America/New_York", timeStyle: "short", dateStyle: "long" })} EST`
        : "";
      await client.chat.postMessage({
        channel: process.env.MIRRORCHANNEL,
        text: `<@${user_id}> shushed <@${userToBan}> from all Slack channels${timeMessage}. ${reason ? `Reason: ${reason}` : ""}`,
      });
    }

    await prisma.bans.create({
      data: {
        admin: user_id,
        reason: reason,
        user: userToBan,
        time: expirationTime,

        // profile_photo: profilePhoto,
        // display_name: displayName,
      },
    });

    if (isAdmin) {
      const timeMessage = expirationTime
        ? ` until ${expirationTime.toLocaleString("en-US", { timeZone: "America/New_York", timeStyle: "short", dateStyle: "long" })} EST`
        : "";
      await client.chat.postMessage({
        channel: userToBan,
        text: `You've been banned from talking in all Slack channels${timeMessage}. A FD member will reach out to you shortly.`,
      });
    }

    if (isAdmin) {
      const timeMessage = expirationTime
        ? ` until ${expirationTime.toLocaleString("en-US", { timeZone: "America/New_York", timeStyle: "short", dateStyle: "long" })} EST`
        : "";
      await client.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `<@${userToBan}> has been shushed from all channels${timeMessage}.`,
      });
    } else {
      const timeMessage = expirationTime
        ? ` until ${expirationTime.toLocaleString("en-US", { timeZone: "America/New_York", timeStyle: "short", dateStyle: "long" })} EST`
        : "";
      await client.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `<@${userToBan}> has been shushed from all channels${timeMessage} for ${reason}`,
        mrkdwn: true,
      });
    }
  } catch (e) {
    await client.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: `An error occured: ${e}`,
    });
  }
}

module.exports = shushBan;
