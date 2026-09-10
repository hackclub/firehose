import { getPrisma } from '../../utils/index.js';
import { RETENTION_DAYS } from './windows.js';

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

function startIndexPrune() {
    async function prune() {
        const prisma = getPrisma();
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        try {
            await prisma.messageIndex.deleteMany({ where: { sentAt: { lt: cutoff } } });
        } catch (e) {
            console.error('[nuke] failed to prune message index:', e);
        }
    }

    setInterval(prune, PRUNE_INTERVAL_MS);
    prune();
}

export default startIndexPrune;
