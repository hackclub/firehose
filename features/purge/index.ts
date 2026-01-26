import type { App } from '@slack/bolt';
import purgeCommand from './command.js';

function register(app: App) {
    app.command(/\/(.*dev-)?purge$/, purgeCommand);
}

export { register };
