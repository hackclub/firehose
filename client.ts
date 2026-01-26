import { WebClient } from '@slack/web-api';
import { env } from './utils/index.js';

const client = new WebClient(env.SLACK_BOT_TOKEN);
const userClient = new WebClient(env.SLACK_USER_TOKEN);

export { client, userClient };
