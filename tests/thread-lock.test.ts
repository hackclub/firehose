/**
 * Tests for the thread lock feature
 *
 * Actually tests the listener with mock events
 */

import { describe, it, expect, beforeAll, afterAll, spyOn, mock } from 'bun:test';
import { getPrisma } from '../utils/index.js';
import * as utils from '../utils/index.js';
import { getTestChannel, generateTestId, createMockMessageEvent } from './test-utils.js';

// We need to mock the client before importing the listener
mock.module('../utils/slack/client.js', () => ({
    client: {
        conversations: {
            join: async () => ({ ok: true }),
        },
    },
    userClient: {
        chat: {
            delete: async () => ({ ok: true }),
        },
        conversations: {
            kick: async () => ({ ok: true }),
        },
    },
}));

// Import after mocking
const { messageListener } = await import('../features/thread_lock/listener.js');

const prisma = getPrisma();

describe('Thread Lock Feature', () => {
    const testChannel = getTestChannel();
    const lockedThreadTs = `${Date.now() / 1000}.000001`;
    const expiredThreadTs = `${Date.now() / 1000}.000002`;
    const adminUserId = `UADMIN${Date.now()}`;
    const regularUserId = `UREGULAR${Date.now()}`;
    let testId: string;

    let postEphemeralCalls: Array<{
        channel: string;
        user: string;
        text: string;
        thread_ts?: string;
    }> = [];
    let logBothCalls: string[] = [];
    let deleteMessageCalls: Array<{ channel: string; ts: string }> = [];
    let removeReactionCalls: Array<{ channel: string; name: string; timestamp: string }> = [];

    beforeAll(async () => {
        testId = generateTestId();

        spyOn(utils, 'postEphemeral').mockImplementation(async (channel, user, text, thread_ts) => {
            postEphemeralCalls.push({ channel, user, text, thread_ts });
        });
        spyOn(utils, 'deleteMessage').mockImplementation(async (channel, ts) => {
            deleteMessageCalls.push({ channel, ts });
        });
        spyOn(utils, 'removeReaction').mockImplementation(async (channel, name, timestamp) => {
            removeReactionCalls.push({ channel, name, timestamp });
        });
        spyOn(utils, 'logBoth').mockImplementation(async (text) => {
            logBothCalls.push(text);
        });
        spyOn(utils, 'isUserAdmin').mockImplementation(async (userId) => {
            return userId === adminUserId;
        });

        // Create a locked thread (active, future unlock time)
        await prisma.thread.create({
            data: {
                id: lockedThreadTs,
                admin: adminUserId,
                lock_type: 'temp',
                time: new Date(Date.now() + 3600000), // 1 hour from now
                reason: `Test lock ${testId}`,
                channel: testChannel,
                active: true,
            },
        });

        // Create an expired thread (active but past unlock time)
        await prisma.thread.create({
            data: {
                id: expiredThreadTs,
                admin: adminUserId,
                lock_type: 'temp',
                time: new Date(Date.now() - 1000), // 1 second ago
                reason: `Expired lock ${testId}`,
                channel: testChannel,
                active: true,
            },
        });
    });

    afterAll(async () => {
        await prisma.thread.deleteMany({
            where: {
                id: { in: [lockedThreadTs, expiredThreadTs] },
            },
        });
        await prisma.log.deleteMany({
            where: {
                thread_id: { in: [lockedThreadTs, expiredThreadTs] },
            },
        });
    });

    describe('messageListener for locked threads', () => {
        it('should not act on messages outside of threads', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: testChannel,
                text: 'Channel message, not thread',
                ts: '1234567890.111111',
            });

            await messageListener(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should not act on unlocked threads', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: testChannel,
                text: 'Message in unlocked thread',
                ts: '1234567890.222222',
                thread_ts: '9999999999.999999', // Non-existent thread
            });

            await messageListener(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should delete messages from regular users in locked threads', async () => {
            deleteMessageCalls = [];
            postEphemeralCalls = [];

            const messageTs = '1234567890.333333';
            const messageText = `Unauthorized reply ${testId}`;
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: testChannel,
                text: messageText,
                ts: messageTs,
                thread_ts: lockedThreadTs,
            });

            await messageListener(mockEvent);

            expect(deleteMessageCalls.length).toBe(1);
            expect(deleteMessageCalls[0].ts).toBe(messageTs);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('locked');
            expect(postEphemeralCalls[0].text).toContain(messageText);
        });

        it('should allow messages from admins in locked threads', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: adminUserId,
                channel: testChannel,
                text: 'Admin reply to locked thread',
                ts: '1234567890.444444',
                thread_ts: lockedThreadTs,
            });

            await messageListener(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });
    });

    describe('auto-unlock on expiration', () => {
        it('should auto-unlock thread when time expires', async () => {
            logBothCalls = [];
            removeReactionCalls = [];

            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: testChannel,
                text: 'Message triggering auto-unlock',
                ts: '1234567890.555555',
                thread_ts: expiredThreadTs,
            });

            await messageListener(mockEvent);

            // Thread should be deactivated
            const thread = await prisma.thread.findFirst({
                where: { id: expiredThreadTs },
            });
            expect(thread?.active).toBe(false);

            // Should log the auto-unlock
            expect(logBothCalls.length).toBeGreaterThan(0);
            expect(logBothCalls[0]).toContain('unlocked');
            expect(logBothCalls[0]).toContain('Autounlock');

            // Should remove lock reaction
            expect(removeReactionCalls.length).toBe(1);
            expect(removeReactionCalls[0].name).toBe('lock');
        });

        it('should allow messages after auto-unlock', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: testChannel,
                text: 'Message after auto-unlock',
                ts: '1234567890.666666',
                thread_ts: expiredThreadTs,
            });

            await messageListener(mockEvent);

            // Message should NOT be deleted since thread is now unlocked
            expect(deleteMessageCalls.length).toBe(0);
        });
    });

    describe('lock logging', () => {
        it('should create log entries when locks are created', async () => {
            const logThreadTs = `${Date.now() / 1000}.000003`;

            await prisma.log.create({
                data: {
                    thread_id: logThreadTs,
                    admin: adminUserId,
                    lock_type: 'temp',
                    time: new Date(Date.now() + 3600000),
                    reason: `Log test ${testId}`,
                    channel: testChannel,
                    active: true,
                },
            });

            const log = await prisma.log.findFirst({
                where: { thread_id: logThreadTs },
            });

            expect(log).not.toBeNull();
            expect(log?.reason).toContain(testId);
            expect(log?.admin).toBe(adminUserId);

            // Cleanup
            await prisma.log.deleteMany({
                where: { thread_id: logThreadTs },
            });
        });
    });
});
