const command = require('./command');
const shortcut = require('./shortcut');
const listener = require('./listener');
const { slowmodeModal, slowmodeThreadModal } = require('./modal');
const { slowmodeDisableButton, slowmodeThreadDisableButton } = require('./actions');

/** @param {import('@slack/bolt').App} app */
function register(app) {
    app.command(/\/.*slowmode$/, command);
    app.shortcut('slowmode_thread', shortcut);
    app.action('slowmode_disable_button', slowmodeDisableButton);
    app.action('slowmode_thread_disable_button', slowmodeThreadDisableButton);
    app.view('slowmode_modal', slowmodeModal);
    app.view('slowmode_thread_modal', slowmodeThreadModal);
}

module.exports = {
    register,
    messageListener: listener,
};
