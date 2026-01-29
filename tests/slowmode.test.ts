/**
 * Tests for the slowmode feature
 *
 * Actually tests the listeners with mock events
 */

import { describe, it, expect, beforeAll, afterAll, spyOn } from 'bun:test';
import { getPrisma } from '../utils/index.js';
import * as utils from '../utils/index.js';
import enforceSlowMode from '../features/slowmode/listener.js';
import { getTestChannel, generateTestId, createMockMessageEvent } from './test-utils.js';

const prisma = getPrisma();

describe('Slowmode Feature', () => {
    const testChannel = getTestChannel();
    const slowmodeChannelId = `CSLOW${Date.now()}`;
    const adminUserId = `UADMIN${Date.now()}`;
    const regularUserId = `UREGULAR${Date.now()}`;
    const whitelistedUserId = `UWHITE${Date.now()}`;
    let testId: string;

    let postEphemeralCalls: Array<{
        channel: string;
        user: string;
        text: string;
        thread_ts?: string;
    }> = [];
    let logInternalCalls: string[] = [];
    let deleteMessageCalls: Array<{ channel: string; ts: string }> = [];

    beforeAll(async () => {
        testId = generateTestId();

        spyOn(utils, 'postEphemeral').mockImplementation(async (channel, user, text, thread_ts) => {
            postEphemeralCalls.push({ channel, user, text, thread_ts });
        });
        spyOn(utils, 'deleteMessage').mockImplementation(async (channel, ts) => {
            deleteMessageCalls.push({ channel, ts });
        });
        spyOn(utils, 'logInternal').mockImplementation(async (text) => {
            logInternalCalls.push(text);
        });
        spyOn(utils, 'isUserAdmin').mockImplementation(async (userId) => {
            return userId === adminUserId;
        });
        spyOn(utils, 'getChannelManagers').mockImplementation(async () => {
            return [];
        });
        spyOn(utils, 'isUserExempt').mockImplementation(async (userId, channel, whitelist) => {
            if (userId === adminUserId) return true;
            if (whitelist?.includes(userId)) return true;
            return false;
        });

        // Create slowmode config
        await prisma.slowmode.create({
            data: {
                channel: slowmodeChannelId,
                threadTs: '',
                locked: true,
                time: 10, // 10 second slowmode
                admin: adminUserId,
                whitelistedUsers: [whitelistedUserId],
            },
        });
    });

    afterAll(async () => {
        await prisma.slowmode.deleteMany({
            where: { channel: slowmodeChannelId },
        });
        await prisma.slowUsers.deleteMany({
            where: { channel: slowmodeChannelId },
        });
    });

    describe('enforceSlowMode listener', () => {
        it('should not act on channels without slowmode', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: 'CNOSLOWMODE',
                text: 'Normal message',
                ts: '1234567890.111111',
            });

            await enforceSlowMode(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should allow first message from user and track them', async () => {
            deleteMessageCalls = [];
            postEphemeralCalls = [];

            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: slowmodeChannelId,
                text: 'First message',
                ts: '1234567890.222222',
            });

            await enforceSlowMode(mockEvent);

            // First message should NOT be deleted
            expect(deleteMessageCalls.length).toBe(0);

            // User should be tracked
            const userData = await prisma.slowUsers.findFirst({
                where: {
                    channel: slowmodeChannelId,
                    user: regularUserId,
                },
            });
            expect(userData).not.toBeNull();
            expect(userData?.lastMessageAt).toBeDefined();
        });

        it('should delete message if sent too soon', async () => {
            deleteMessageCalls = [];
            postEphemeralCalls = [];

            const messageText = `Too fast message ${testId}`;
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: slowmodeChannelId,
                text: messageText,
                ts: '1234567890.333333',
            });

            await enforceSlowMode(mockEvent);

            // Message should be deleted (sent within 10 seconds)
            expect(deleteMessageCalls.length).toBe(1);

            // User should get ephemeral with time remaining
            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('Slowmode active');
            expect(postEphemeralCalls[0].text).toContain(messageText);
        });

        it('should allow message after cooldown expires', async () => {
            deleteMessageCalls = [];

            // Manually set lastMessageAt to 15 seconds ago
            const oldTime = Math.floor(Date.now() / 1000) - 15;
            await prisma.slowUsers.updateMany({
                where: {
                    channel: slowmodeChannelId,
                    user: regularUserId,
                },
                data: {
                    lastMessageAt: oldTime,
                },
            });

            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: slowmodeChannelId,
                text: 'Message after cooldown',
                ts: '1234567890.444444',
            });

            await enforceSlowMode(mockEvent);

            // Message should NOT be deleted
            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should allow messages from admins', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: adminUserId,
                channel: slowmodeChannelId,
                text: 'Admin message',
                ts: '1234567890.555555',
            });

            await enforceSlowMode(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should allow messages from whitelisted users', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: whitelistedUserId,
                channel: slowmodeChannelId,
                text: 'Whitelisted user message',
                ts: '1234567890.666666',
            });

            await enforceSlowMode(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should ignore messages with subtypes', async () => {
            deleteMessageCalls = [];

            // Set user's last message to now so they'd be rate limited
            await prisma.slowUsers.updateMany({
                where: {
                    channel: slowmodeChannelId,
                    user: regularUserId,
                },
                data: {
                    lastMessageAt: Math.floor(Date.now() / 1000),
                },
            });

            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: slowmodeChannelId,
                text: 'Message with subtype',
                ts: '1234567890.777777',
                subtype: 'message_changed',
            });

            await enforceSlowMode(mockEvent);

            // Should ignore subtypes
            expect(deleteMessageCalls.length).toBe(0);
        });
    });

    describe('slowmode expiration', () => {
        const expiredChannelId = `CEXPIRED${Date.now()}`;

        beforeAll(async () => {
            // Create an expired slowmode
            await prisma.slowmode.create({
                data: {
                    channel: expiredChannelId,
                    threadTs: '',
                    locked: true,
                    time: 30,
                    admin: adminUserId,
                    expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
                },
            });
        });

        afterAll(async () => {
            await prisma.slowmode.deleteMany({
                where: { channel: expiredChannelId },
            });
            await prisma.slowUsers.deleteMany({
                where: { channel: expiredChannelId },
            });
        });

        it('should auto-disable expired slowmode on message', async () => {
            logInternalCalls = [];

            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: expiredChannelId,
                text: 'Message triggering expiry check',
                ts: '1234567890.888888',
            });

            await enforceSlowMode(mockEvent);

            // Slowmode should be disabled
            const config = await prisma.slowmode.findFirst({
                where: { channel: expiredChannelId, threadTs: '' },
            });
            expect(config?.locked).toBe(false);

            // Should log the auto-disable
            expect(logInternalCalls.length).toBeGreaterThan(0);
            expect(logInternalCalls[0]).toContain('expired');
        });
    });

    describe('thread-specific slowmode', () => {
        const threadTs = '1234567890.000001';
        const threadUserId = `UTHREAD${Date.now()}`;

        beforeAll(async () => {
            await prisma.slowmode.create({
                data: {
                    channel: slowmodeChannelId,
                    threadTs: threadTs,
                    locked: true,
                    time: 5,
                    admin: adminUserId,
                },
            });
        });

        afterAll(async () => {
            await prisma.slowmode.deleteMany({
                where: { channel: slowmodeChannelId, threadTs: threadTs },
            });
            await prisma.slowUsers.deleteMany({
                where: { channel: slowmodeChannelId, threadTs: threadTs },
            });
        });

        it('should enforce slowmode only in specific thread', async () => {
            deleteMessageCalls = [];

            // First message in thread - should be allowed
            const mockEvent1 = createMockMessageEvent({
                user: threadUserId,
                channel: slowmodeChannelId,
                text: 'First thread message',
                ts: '1234567890.999991',
                thread_ts: threadTs,
            });

            await enforceSlowMode(mockEvent1);
            expect(deleteMessageCalls.length).toBe(0);

            // Second message immediately - should be deleted
            deleteMessageCalls = [];
            const mockEvent2 = createMockMessageEvent({
                user: threadUserId,
                channel: slowmodeChannelId,
                text: 'Second thread message too fast',
                ts: '1234567890.999992',
                thread_ts: threadTs,
            });

            await enforceSlowMode(mockEvent2);
            expect(deleteMessageCalls.length).toBe(1);
        });
    });
});
