require("dotenv").config();
const { App } = require("@slack/bolt");
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  // port: 3008
});

let archiveList = ["C078K46G9NU"];

const logChannel = "C077YSMMAPL";

app.message("archive", async ({ message, say, client, body }) => {
  const checkChannel = app.client.conversations.info({
    channel: "C078K46G9NU",
  });

  const userInfo = app.client.users.info({
    user: message.user,
  });

  const isAdmin = (await userInfo).user.is_admin;
  const inChannel = (await checkChannel).channel.is_member; // returns true or false
  const isArchived = (await checkChannel).channel.is_archived;
  await say(`${inChannel}`);
  await say(`${isArchived}`);
  await say(`${isAdmin}`);
  try {
    switch (inChannel) {
      case true:
        if ((isArchived = false)) {
          if (isAdmin) {
            for (let channel; channel < archiveList; channel++) {
              app.client.chat.postMessage({
                channel: archiveList[channel],
                text: "Archiving this channel! If you want to contest, dm @arav",
              });
              app.client.conversations.archive({
                token: process.env.SLACK_USER_TOKEN,
                channel: "C078K46G9NU",
              });
              app.client.chat.postMessage({
                channel: logChannel,
                text: "Archived",
              });
            }
          }
        } else if (!isAdmin) {
          await say("Only admins can run this");
        }
        break;
      case false:
        app.client.conversations.join({
          channel: "C078K46G9NU",
        });
        app.client.chat.postMessage({
          channel: "C078K46G9NU",
          text: "Archiving this channel! If you want to contest, dm @arav",
        });
        app.client.conversations.archive({
          token: process.env.SLACK_USER_TOKEN,
          channel: "C078K46G9NU",
        });
        app.client.chat.postMessage({
          channel: "C077YSMMAPL",
          text: "Archived",
        });
        break;
    }
  } catch (e) {
    await say("There's an error" + e);
  }
});

(async () => {
  // Start your app
  await app.start();

  console.log("⚡️ Bolt app is running!");
})();
