import type { App } from '@slack/bolt';
import listener from './listener.js';
export function register(app: App) {
	app.event('reaction_added', listener);
}
