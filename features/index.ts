const slowmode = require('./slowmode');
const readonly = require('./readonly');
const channelBan = require('./channel_ban');
const shush = require('./shush');
const purge = require('./purge');
const threadLock = require('./thread_lock');

const features = [slowmode, readonly, channelBan, shush, purge, threadLock];

module.exports = {
    features,
    slowmode,
    readonly,
    channelBan,
    shush,
    purge,
    threadLock,
};
