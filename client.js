const { WebClient } = require('@slack/web-api');
const { env } = require('./utils');

const client = new WebClient(env.SLACK_BOT_TOKEN);
const userClient = new WebClient(env.SLACK_USER_TOKEN);

module.exports = { client, userClient };
