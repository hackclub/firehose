import type { App } from '@slack/bolt';
import botBanCommand from './ban.js';
import botUnbanCommand from './unban.js';
import botBanListCommand from './list.js';
import listenForAppInstalled from './listener.js';

function register(app: App) {
    app.command(/\/(.*dev-)?botban$/, botBanCommand);
    app.command(/\/(.*dev-)?botunban$/, botUnbanCommand);
    app.command(/\/(.*dev-)?botbanlist$/, botBanListCommand);

    app.event('app_installed', listenForAppInstalled);
}

export { register };
