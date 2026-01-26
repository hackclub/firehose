const shushCommand = require('./shush');
const unshushCommand = require('./unshush');
// const banlist = require('./banlist');
const listener = require('./listener');

/** @param {import('@slack/bolt').App} app */
function register(app) {
    app.command(/\/.*shush$/, shushCommand);
    app.command(/\/.*unshush$/, unshushCommand);
}

module.exports = {
    register,
    messageListener: listener,
};
