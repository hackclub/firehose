import type { App } from '@slack/bolt';
import command from './command.js';
import unban from './unban.js';
import listener from './listener.js';
import startAutoUnban from './tasks.js';

function register(app: App) {
    app.command(/\/(.*dev-)?channelban$/, command);
    app.command(/\/(.*dev-)?unban$/, unban);
    startAutoUnban();
}

export { register, listener as messageListener };
