import type { App } from '@slack/bolt';
import command from './command.js';
import listener from './listener.js';

function register(app: App) {
    app.command(/\/(.*dev-)?newaccount$/, command);
}

export { register, listener as messageListener };
