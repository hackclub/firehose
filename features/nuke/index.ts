import type { App } from '@slack/bolt';
import command from './command.js';
import registerModal from './modal.js';

function register(app: App) {
    app.command(/\/(.*dev-)?nuke$/, command);
    registerModal(app);
}

export { register };
