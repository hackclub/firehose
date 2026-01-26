import type { Router } from 'express';
import { getPrisma, env } from '../../utils/index.js';

function registerRoutes(router: Router) {
    const prisma = getPrisma();

    router.get('/lock', async (req, res) => {
        const { key } = req.query;
        if (!env.API_KEY || key !== env.API_KEY) {
            return res.status(401).json({ ok: false, error: 'Please provide a valid API key' });
        }
        const threads = await prisma.thread.findMany({
            where: {},
        });
        return res.json(threads);
    });

    router.post('/lock', async (req, res) => {
        const { id, user, time: timeRaw, reason, channel, key } = req.query;
        if (!env.API_KEY || key !== env.API_KEY) {
            return res.status(401).json({ ok: false, error: 'Please provide a valid API key' });
        }
        const time = timeRaw ? new Date(timeRaw as string) : null;
        const reasonVal = reason ?? '(none)';
        if (!id || !user || !timeRaw || !time || isNaN(time.getTime()) || !channel) {
            return res.status(400).json({ ok: false, error: 'Give all of the fields' });
        }

        const thread = await prisma.thread.findFirst({
            where: {
                id: id as string,
            },
        });

        var action = '';

        if (!thread) {
            await prisma.thread.create({
                data: {
                    id: id as string,
                    admin: user as string,
                    lock_type: 'test',
                    time: time,
                    reason: reason as string,
                    channel: channel as string,
                    active: true,
                },
            });
            await prisma.log.create({
                data: {
                    thread_id: id as string,
                    admin: user as string,
                    lock_type: 'lock',
                    time: time,
                    reason: reasonVal as string,
                    channel: channel as string,
                    active: true,
                },
            });
            action = 'locked';
        } else if (thread.active) {
            await prisma.thread.update({
                where: {
                    id: id as string,
                },
                data: {
                    id: id as string,
                    admin: user as string,
                    active: false,
                },
            });
            await prisma.log.create({
                data: {
                    thread_id: id as string,
                    admin: user as string,
                    lock_type: 'unlock',
                    time: time,
                    reason: reasonVal as string,
                    channel: channel as string,
                    active: false,
                },
            });
            action = 'unlocked';
        } else {
            await prisma.thread.update({
                where: {
                    id: id as string,
                },
                data: {
                    id: id as string,
                    admin: user as string,
                    time: time,
                    active: true,
                },
            });
            await prisma.log.create({
                data: {
                    thread_id: id as string,
                    admin: user as string,
                    lock_type: 'lock',
                    time: time,
                    reason: reasonVal as string,
                    channel: channel as string,
                    active: true,
                },
            });
            action = 'locked';
        }
        res.json({ success: true, action });
    });
}

export default registerRoutes;
