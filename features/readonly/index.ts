import type { App } from '@slack/bolt';
import command from './command.js';
import whitelist from './whitelist.js';
import listener from './listener.js';

function register(app: App) {
    app.command(/\/(.*dev-)?read-only$/, command);
    app.command(/\/(.*dev-)?whitelist$/, whitelist);
}

export { register, listener as messageListener };
