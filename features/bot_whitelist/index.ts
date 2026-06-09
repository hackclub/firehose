import type { App } from '@slack/bolt';
import botWhitelistCommand from './command.js';
import { onMemberJoined, messageListener } from './listener.js';

function register(app: App) {
    app.command(/\/(.*dev-)?bot-whitelist$/, botWhitelistCommand);
    app.event('member_joined_channel', onMemberJoined);
}

export { register, messageListener };
