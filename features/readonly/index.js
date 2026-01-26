const command = require('./command');
const whitelist = require('./whitelist');
const listener = require('./listener');

/** @param {import('@slack/bolt').App} app */
function register(app) {
    app.command(/\/.*read-only$/, command);
    app.command(/\/.*whitelist$/, whitelist);
}

module.exports = {
    register,
    messageListener: listener,
};
