import { App, SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { receiver, startExpressServer } from './endpoints/index.js';
import { features } from './features/index.js';
import { env, logInternal } from './utils/index.js';

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
        console.error(e);
    }
});

app.event('channel_left', async ({ event, client }) => {
    if (isDevMode) return;

    try {
        const channelID = event.channel;
        const channelInfo = await client.conversations.info({ channel: channelID });
        if (channelInfo.channel?.is_archived) return;

        const user = event.actor_id;
        await client.conversations.join({ channel: channelID });
        await logInternal(`User <@${user}> removed Firehose from <#${channelID}>, rejoining!`);
    } catch (e) {
        console.error(e);
    }
});

type MessageListener = (
    args: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs
) => Promise<void>;

const messageListeners: MessageListener[] = features
    .filter((f): f is typeof f & { messageListener: MessageListener } => 'messageListener' in f)
    .map((f) => f.messageListener);

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
