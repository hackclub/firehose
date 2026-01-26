const { getPrisma, env } = require('../../utils');

/**
 * @param {import('express').Router} router
 */
function registerRoutes(router) {
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
        const time = timeRaw ? new Date(/** @type {string} */ (timeRaw)) : null;
        const reasonVal = reason ?? '(none)';
        if (!id || !user || !timeRaw || !time || isNaN(time.getTime()) || !channel) {
            return res.status(400).json({ ok: false, error: 'Give all of the fields' });
        }

        const thread = await prisma.thread.findFirst({
            where: {
                id: /** @type {string} */ (id),
            },
        });

        var action = '';

        if (!thread) {
            await prisma.thread.create({
                data: {
                    id: /** @type {string} */ (id),
                    admin: /** @type {string} */ (user),
                    lock_type: 'test',
                    time: time,
                    reason: /** @type {string} */ (reason),
                    channel: /** @type {string} */ (channel),
                    active: true,
                },
            });
            await prisma.log.create({
                data: {
                    thread_id: /** @type {string} */ (id),
                    admin: /** @type {string} */ (user),
                    lock_type: 'lock',
                    time: time,
                    reason: /** @type {string} */ (reasonVal),
                    channel: /** @type {string} */ (channel),
                    active: true,
                },
            });
            action = 'locked';
        } else if (thread.active) {
            await prisma.thread.update({
                where: {
                    id: /** @type {string} */ (id),
                },
                data: {
                    id: /** @type {string} */ (id),
                    admin: /** @type {string} */ (user),
                    active: false,
                },
            });
            await prisma.log.create({
                data: {
                    thread_id: /** @type {string} */ (id),
                    admin: /** @type {string} */ (user),
                    lock_type: 'unlock',
                    time: time,
                    reason: /** @type {string} */ (reasonVal),
                    channel: /** @type {string} */ (channel),
                    active: false,
                },
            });
            action = 'unlocked';
        } else {
            await prisma.thread.update({
                where: {
                    id: /** @type {string} */ (id),
                },
                data: {
                    id: /** @type {string} */ (id),
                    admin: /** @type {string} */ (user),
                    time: time,
                    active: true,
                },
            });
            await prisma.log.create({
                data: {
                    thread_id: /** @type {string} */ (id),
                    admin: /** @type {string} */ (user),
                    lock_type: 'lock',
                    time: time,
                    reason: /** @type {string} */ (reasonVal),
                    channel: /** @type {string} */ (channel),
                    active: true,
                },
            });
            action = 'locked';
        }
        res.json({ success: true, action });
    });
}

module.exports = registerRoutes;
