import type { App } from '@slack/bolt';
import shushCommand from './shush.js';
import unshushCommand from './unshush.js';
import listener from './listener.js';
import startAutoUnshush from './tasks.js';

function register(app: App) {
    app.command(/\/(.*dev-)?shush$/, shushCommand);
    app.command(/\/(.*dev-)?unshush$/, unshushCommand);
    startAutoUnshush();
}

export { register, listener as messageListener };
