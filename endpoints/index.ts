import { ExpressReceiver } from '@slack/bolt';
import express from 'express';
import { env } from '../utils/index.js';

import rootEndpoint from './root.js';
import pingEndpoint from './ping.js';

const isDevMode = env.NODE_ENV === 'development';

const receiver = new ExpressReceiver({
    signingSecret: env.SLACK_SIGNING_SECRET,
});

receiver.router.use(express.json());
receiver.router.get('/', rootEndpoint);
receiver.router.get('/ping', pingEndpoint);

function startExpressServer() {
    const app = express();
    app.use(express.json());
    app.get('/', rootEndpoint);
    app.get('/ping', pingEndpoint);

    const port = env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Express server running on port ${port}`);
    });

    return app;
}

export { receiver, startExpressServer };
