const command = require('./command');
const unban = require('./unban');
const listener = require('./listener');

/** @param {import('@slack/bolt').App} app */
function register(app) {
    app.command(/\/.*channelban$/, command);
    app.command(/\/.*unban$/, unban);
}

module.exports = {
    register,
    messageListener: listener,
};
