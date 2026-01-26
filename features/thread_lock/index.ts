import type { App } from '@slack/bolt';
import type { Router } from 'express';

import registerShortcuts from './shortcut.js';
import registerModal from './modal.js';
import { messageListener } from './listener.js';
import startAutoUnlock from './tasks.js';
import registerRoutes from './api.js';

function register(app: App, router: Router) {
    registerShortcuts(app);
    registerModal(app);
    startAutoUnlock();
    registerRoutes(router);
}

export { register, messageListener };
