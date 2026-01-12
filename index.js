const { App, LogLevel, ExpressReceiver } = require("@slack/bolt");
require("dotenv").config();
const { getPrisma } = require('./utils/prismaConnector.js');
const prisma = getPrisma();
const express = require('express')


const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
})


const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    receiver,
    socketMode: false,
    appToken: process.env.SLACK_APP_TOKEN,
    port: process.env.PORT || 3000,
});

receiver.router.use(express.json())
receiver.router.get('/', require('./endpoints/index'))
receiver.router.get('/ping', require('./endpoints/ping'))

app.client.chat.postMessage({
    channel: process.env.MIRRORCHANNEL,
    text: `Firehose is online again!`
})

app.event("channel_created", async ({ event, client }) => {
    try {
        const channelId = event.channel.id;
        await client.conversations.join({ channel: channelId });
    } catch (e) {
        app.logger.error(e)
    } 
});

app.event("channel_left", async ({ event, client }) => {
  try {
    const channelID = event.channel;
    const user = event.actor_id;
    console.log(
      `User <@${user}> removed Firehose from <#${channelID}>, rejoining!`,
    );
    app.client.chat.postMessage({
      channel: process.env.MIRRORCHANNEL,
      text: `User </@${user}> removed Firehose from <#${channelID}>, rejoining!`,
    });
    await client.conversations.join({ channel: channelID });
  } catch (e) {
    console.log(e);
  }
});

app.event('message', async (args) => {
    // begin the firehose
    const { body, client } = args
    const { event } = body
    const { type, subtype, user, channel, ts, text } = event

    const cleanupChannel = await require("./interactions/cleanupChannel.js");
    await cleanupChannel(args);
    const shushBan = await require("./interactions/listenforBannedUser.js");
    await shushBan(args);
    const startSlowMode = await require("./interactions/startSlowMode.js");
    await startSlowMode(args);
    const listenforChannelBannedUser = await require("./interactions/listenforChannelBannedUser.js");
    await listenforChannelBannedUser(args);


});

const handleEvent = require("./events/index.js");
const handleAction = require("./actions/index.js");
const handleViews = require("./views/index.js");

app.event(/.*/, handleEvent); // Catch all events dynamically
app.action(/.*/, handleAction) // Catch all actions dynamically
app.view(/.*/, handleViews)

app.shortcut('slowmode_thread', async (args) => {
    await require('./shortcuts/slowmode_thread')(args);
})

app.command(/.*?/, async (args) => {

    const { ack, command, respond } = args;

    await ack();

    switch (command.command) {
        case '/channelban':
            await require('./commands/channelBan')(args);
            break;
        case '/unban':
            await require('./commands/unban')(args);
            break;
        case '/read-only':
            await require('./commands/readOnly')(args);
            break;
        case '/slowmode':
            await require('./commands/slowmode.js')(args);
            break;
        case '/whitelist':
            await require('./commands/whitelist.js')(args);
            break;
        case '/shush':
            await require('./commands/shush.js')(args);
            break;
        case '/unshush':
            await require('./commands/unshush.js')(args);
            break;
        case '/purge':
            await require('./commands/purge.js')(args)
            break;
        default:
            await respond(`I don't know how to respond to the command ${command.command}`);
            break;
    }

})


// Start the app on the specified port
const port = process.env.PORT || 3000; // Get the port from environment variable or default to 3000
app.start(port).then(() => {
    app.logger.info(`Bolt is running on `)
});
