const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const { env } = require('./utils/env.js');
const { getPrisma } = require('./utils/prismaConnector.js');
const prisma = getPrisma();

const indexEndpoint = require('./endpoints/index');
const pingEndpoint = require('./endpoints/ping');

const cleanupChannel = require('./interactions/cleanupChannel.js');
const listenforBannedUser = require('./interactions/listenforBannedUser.js');
const startSlowMode = require('./interactions/startSlowMode.js');
const listenforChannelBannedUser = require('./interactions/listenforChannelBannedUser.js');

const channelBanCommand = require('./commands/channelBan');
const unbanCommand = require('./commands/unban');
const readOnlyCommand = require('./commands/readOnly');
const slowmodeCommand = require('./commands/slowmode.js');
const whitelistCommand = require('./commands/whitelist.js');
const shushCommand = require('./commands/shush.js');
const unshushCommand = require('./commands/unshush.js');
const purgeCommand = require('./commands/purge.js');

const isDevMode = env.NODE_ENV === 'development';
const devChannel = env.DEV_CHANNEL;

const receiver = new ExpressReceiver({
    signingSecret: env.SLACK_SIGNING_SECRET,
});

const app = new App({
    token: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    receiver: isDevMode ? undefined : receiver,
    socketMode: isDevMode,
    appToken: env.SLACK_APP_TOKEN,
    port: Number(env.PORT) || 3000,
});

receiver.router.use(express.json());
receiver.router.get('/', indexEndpoint);
receiver.router.get('/ping', pingEndpoint);

if (!isDevMode) {
    app.client.chat.postMessage({
        channel: env.MIRRORCHANNEL,
        text: `Firehose is online again!`,
    });
}

app.event('channel_created', async ({ event, client }) => {
    if (isDevMode) return;

    try {
        const channelId = event.channel.id;
        await client.conversations.join({ channel: channelId });
    } catch (e) {
        app.logger.error(e);
    }
});

app.event('channel_left', async ({ event, client }) => {
    if (isDevMode) return;

    try {
        const channelID = event.channel;
        const user = event.actor_id;
        console.log(`User <@${user}> removed Firehose from <#${channelID}>, rejoining!`);
        app.client.chat.postMessage({
            channel: env.MIRRORCHANNEL,
            text: `User </@${user}> removed Firehose from <#${channelID}>, rejoining!`,
        });
        await client.conversations.join({ channel: channelID });
    } catch (e) {
        console.log(e);
    }
});

app.event('message', async (args) => {
    // begin the firehose
    const { body, client } = args;
    const { event } = body;
    if (!event || !event.type || event.type !== 'message' || !('user' in event)) return;
    const { type, subtype, user, channel, ts, text } = event;

    console.log('New message event received:', { type, subtype, user, channel, ts, text });

    if (isDevMode && channel !== devChannel) return;

    await cleanupChannel(args);
    await listenforBannedUser(args);
    await startSlowMode(args);
    await listenforChannelBannedUser(args);
});

app.command(/.*?/, async (args) => {
    const { ack, command, respond } = args;

    await ack();

    switch (command.command.replace(/^\/.*dev-/, '/')) {
        case '/channelban':
            await channelBanCommand(args);
            break;
        case '/unban':
            await unbanCommand(args);
            break;
        case '/read-only':
            await readOnlyCommand(args);
            break;
        case '/slowmode':
            await slowmodeCommand(args);
            break;
        case '/whitelist':
            await whitelistCommand(args);
            break;
        case '/shush':
            await shushCommand(args);
            break;
        case '/unshush':
            await unshushCommand(args);
            break;
        case '/purge':
            await purgeCommand(args);
            break;
        default:
            await respond(`I don't know how to respond to the command ${command.command}`);
            break;
    }
});

// Start the app on the specified port
const port = env.PORT || 3000; // Get the port from environment variable or default to 3000
app.start(port).then(() => {
    app.logger.info(`Bolt is running on port ${port}`);
});
