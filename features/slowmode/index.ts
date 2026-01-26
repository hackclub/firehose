import type { App } from '@slack/bolt';
import command from './command.js';
import shortcut from './shortcut.js';
import listener from './listener.js';
import { slowmodeModal, slowmodeThreadModal } from './modal.js';
import { slowmodeDisableButton, slowmodeThreadDisableButton } from './actions.js';

function register(app: App) {
    app.command(/\/(.*dev-)?slowmode$/, command);
    app.shortcut('slowmode_thread', shortcut);
    app.action('slowmode_disable_button', slowmodeDisableButton);
    app.action('slowmode_thread_disable_button', slowmodeThreadDisableButton);
    app.view('slowmode_modal', slowmodeModal);
    app.view('slowmode_thread_modal', slowmodeThreadModal);
}

export { register, listener as messageListener };
