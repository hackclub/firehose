const { App } = require('@slack/bolt');
const { receiver, startExpressServer } = require('./endpoints');
const { features } = require('./features');
const { env, logInternal } = require('./utils');

const isDevMode = env.NODE_ENV === 'development';
const devChannel = env.DEV_CHANNEL;

const app = new App({
    token: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    receiver: isDevMode ? undefined : receiver,
    socketMode: isDevMode,
    appToken: env.SLACK_APP_TOKEN,
    port: Number(env.PORT) || 3000,
});

for (const feature of features) {
    if (feature.register) {
        feature.register(app, receiver.router);
    }
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
        const channelInfo = await client.conversations.info({ channel: channelID });
        if (channelInfo.channel?.is_archived) return;

        const user = event.actor_id;
        console.log(`User <@${user}> removed Firehose from <#${channelID}>, rejoining!`);
        logInternal(`User <@${user}> removed Firehose from <#${channelID}>, rejoining!`);
        await client.conversations.join({ channel: channelID });
    } catch (e) {
        console.log(e);
    }
});

/** @type {((args: import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs) => Promise<void>)[]} */
const messageListeners = features
    .map((f) => ('messageListener' in f ? f.messageListener : undefined))
    .filter((listener) => listener !== undefined);

app.event('message', async (args) => {
    const { body } = args;
    const { event } = body;
    if (!event || !event.type || event.type !== 'message' || !('user' in event)) return;
    const { channel } = event;

    if (isDevMode && channel !== devChannel) return;

    await Promise.all(messageListeners.map((listener) => listener(args)));
});

const port = env.PORT || 3000;

if (isDevMode) {
    startExpressServer();
}

app.start(port).then(() => {
    app.logger.info(`Bolt is running on port ${port}`);
});
