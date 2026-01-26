import type { App } from '@slack/bolt';
import shushCommand from './shush.js';
import unshushCommand from './unshush.js';
import listener from './listener.js';

function register(app: App) {
    app.command(/\/(.*dev-)?shush$/, shushCommand);
    app.command(/\/(.*dev-)?unshush$/, unshushCommand);
}

export { register, listener as messageListener };
