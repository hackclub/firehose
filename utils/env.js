require('dotenv').config();

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const env = {
    SLACK_SIGNING_SECRET: requireEnv('SLACK_SIGNING_SECRET'),
    SLACK_BOT_TOKEN: requireEnv('SLACK_BOT_TOKEN'),
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN,
    SLACK_USER_TOKEN: process.env.SLACK_USER_TOKEN,
    SLACK_BROWSER_TOKEN: process.env.SLACK_BROWSER_TOKEN,
    SLACK_COOKIE: process.env.SLACK_COOKIE,
    MIRRORCHANNEL: requireEnv('MIRRORCHANNEL'),
    DEV_CHANNEL: process.env.DEV_CHANNEL,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
};

module.exports = { env };
