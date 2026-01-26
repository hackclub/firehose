const command = require('./command');

/** @param {import('@slack/bolt').App} app */
function register(app) {
    app.command(/\/.*purge$/, command);
}

module.exports = {
    register,
};
