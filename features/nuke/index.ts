import type { App } from '@slack/bolt';
import command from './command.js';
import listener from './listener.js';
import registerModal from './modal.js';
import startIndexPrune from './tasks.js';

function register(app: App) {
    app.command(/\/(.*dev-)?nuke$/, command);
    registerModal(app);
    startIndexPrune();
}

export { register, listener as messageListener };
