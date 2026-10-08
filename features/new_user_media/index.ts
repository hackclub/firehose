import type { App } from '@slack/bolt';
import listener from './listener.js';

function register(_app: App) {
    // not needed
}

export { register, listener as messageListener };
