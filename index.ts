import { App, SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { receiver, startExpressServer } from './endpoints/index.js';
import { features, botWhitelist } from './features/index.js';
import {
    env,
    logInternal,
    getPrisma,
    isUserInFirehouse,
    postEphemeral,
    postMessage,
} from './utils/index.js';

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

app.event('team_join', async ({ event }) => {
  const prisma = getPrisma();
  await prisma.memberJoinDate.upsert({
    where: { userId: event.user.id },
    update: {},
    create: { userId: event.user.id, joinedAt: new Date() },
  });
});

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
    await logInternal(
      `<@${user}> removed Firehose from <#${channelID}>, attempting to rejoin!`
    );
  } catch (e) {
    console.error(e);
  }
});

type MessageListener = (
  args: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs
) => Promise<void>;

const messageListeners: MessageListener[] = features
  .filter((f): f is typeof f & { messageListener: MessageListener } => (
    'messageListener' in f && (f as any).messageListener !== botWhitelist.messageListener
  ))
  .map((f) => f.messageListener);

// bot messages often have no `user` field, so the handler below would drop them.
app.event('message', async (args) => {
  const { body } = args;
  const { event } = body;
  if (!event || !event.type || event.type !== 'message') return;
  const { channel } = event;

  if (isDevMode && channel !== devChannel) return;

  await botWhitelist.messageListener(args);
});

app.event('message', async (args) => {
  const { body } = args;
  const { event } = body;
  if (!event || !event.type || event.type !== 'message' || !('user' in event)) return;
  const { channel } = event;

  if (isDevMode && channel !== devChannel) return;

  await Promise.all(messageListeners.map((listener) => listener(args)));
});

app.use(async (args) => {
    if (isDevMode || !('ack' in args) || typeof args.ack !== 'function') {
        await args.next();
        return;
    }

    const body = args.body as {
        user_id?: string;
        user?: { id?: string };
        channel_id?: string;
        channel?: { id?: string };
    };
    const userId = body.user_id ?? body.user?.id;
    if (!userId) {
        await args.next();
        return;
    }

    let allowed = false;
    try {
        allowed = await isUserInFirehouse(userId);
    } catch (e) {
        console.error('[fd-gate] membership lookup failed:', e);
    }

    if (allowed) {
        await args.next();
        return;
    }

    await args.ack();

    const message = 'Sorry, you need to be in the FD to use Firehose.';
    const channel = body.channel_id ?? body.channel?.id;
    try {
        if (channel) {
            await postEphemeral(channel, userId, message);
        } else {
            await postMessage(userId, message);
        }
    } catch (e) {
        console.error('[fd-gate] could not notify user:', e);
    }
});

async function joinAllChannels(client: App['client']) {
  let cursor: string | undefined;
  let joined = 0;
  let failed = 0;

  do {
    const result = await client.conversations.list({
      exclude_archived: true,
      types: 'public_channel',
      limit: 200,
      cursor,
    });

    for (const channel of result.channels ?? []) {
      if (channel.is_member || !channel.id) continue;
      try {
        await client.conversations.join({ channel: channel.id });
        joined++;
        if (joined % 100 === 0) app.logger.info(`joinAllChannels: joined ${joined} so far...`);
        await new Promise((r) => setTimeout(r, 1300));
      } catch {
        failed++;
      }
    }

    cursor = result.response_metadata?.next_cursor;
  } while (cursor);

  app.logger.info(`joinAllChannels: joined ${joined}, failed ${failed}`);
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const port = env.PORT || 3000;

if (isDevMode) {
  startExpressServer();
}

app.start(port).then(async () => {
  app.logger.info(`Bolt is running on port ${port}`);

  if (!isDevMode) {
    await joinAllChannels(app.client);
    setInterval(() => joinAllChannels(app.client), ONE_DAY_MS);
  }
});
