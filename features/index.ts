import * as slowmode from './slowmode/index.js';
import * as readonly from './readonly/index.js';
import * as channelBan from './channel_ban/index.js';
import * as shush from './shush/index.js';
import * as purge from './purge/index.js';
import * as threadLock from './thread_lock/index.js';
import * as threadDestroy from './thread_destroy/index.js';
import * as botBan from './bot_ban/index.js';

export const features = [
    slowmode,
    readonly,
    channelBan,
    shush,
    purge,
    threadLock,
    threadDestroy,
    botBan,
];

export { slowmode, readonly, channelBan, shush, purge, threadLock, threadDestroy, botBan };
