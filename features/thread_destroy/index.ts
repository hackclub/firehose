import type { App } from '@slack/bolt';
import type { Router } from 'express';

import registerShortcuts from './shortcut.js';
import registerModal from './modal.js';

function register(app: App, router: Router) {
    registerShortcuts(app);
    registerModal(app);
}

export { register };
