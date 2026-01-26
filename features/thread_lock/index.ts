const registerShortcuts = require('./shortcut');
const registerModal = require('./modal');
const { messageListener } = require('./listener');
const startAutoUnlock = require('./tasks');
const registerRoutes = require('./api');

/**
 * @param {import('@slack/bolt').App} app
 * @param {import('express').Router} router
 */
function register(app, router) {
    registerShortcuts(app);
    registerModal(app);
    startAutoUnlock();
    registerRoutes(router);
}

module.exports = {
    register,
    messageListener,
};
