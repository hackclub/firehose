/**
 * Tests for the shush/unshush feature
 *
 * Actually tests the command handlers and listeners with mock events
 */

import { describe, it, expect, beforeAll, afterAll, spyOn, mock } from 'bun:test';
import { getPrisma } from '../utils/index.js';
import * as utils from '../utils/index.js';
import shushCommand from '../features/shush/shush.js';
import unshushCommand from '../features/shush/unshush.js';

// Mock userClient to avoid real API calls for kick
mock.module('../utils/slack/client.js', () => ({
    client: {
        chat: { postEphemeral: async () => ({ ok: true }) },
    },
    userClient: {
        chat: { delete: async () => ({ ok: true }) },
        conversations: { kick: async () => ({ ok: true }) },
    },
}));

const { default: listenForBannedUser } = await import('../features/shush/listener.js');
import {
    getTestChannel,
    generateTestId,
    createMockCommandPayload,
    createMockMessageEvent,
} from './test-utils.js';

const prisma = getPrisma();

describe('Shush Feature', () => {
    const testChannel = getTestChannel();
    const testUserId = `USHUSH${Date.now()}`;
    const adminUserId = `UADMIN${Date.now()}`;
    let testId: string;

    let postEphemeralCalls: Array<{ channel: string; user: string; text: string }> = [];
    let postMessageCalls: Array<{ channel: string; text: string }> = [];
    let logInternalCalls: string[] = [];
    let deleteMessageCalls: Array<{ channel: string; ts: string }> = [];

    beforeAll(() => {
        testId = generateTestId();

        spyOn(utils, 'postEphemeral').mockImplementation(async (channel, user, text) => {
            postEphemeralCalls.push({ channel, user, text });
        });
        spyOn(utils, 'postMessage').mockImplementation(async (channel, text) => {
            postMessageCalls.push({ channel, text });
            return { ok: true, ts: '1234567890.123456' } as any;
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
    });

    afterAll(async () => {
        await prisma.bans.deleteMany({
            where: { user: testUserId },
        });
    });

    describe('shushCommand', () => {
        it('should reject non-admin users', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/shush',
                text: `<@${testUserId}> test reason`,
                user_id: 'UNOTADMIN',
                channel_id: testChannel,
            });

            await shushCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain("don't have permission");
        });

        it('should require a user argument', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/shush',
                text: '',
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await shushCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('user is required');
        });

        it('should require a reason', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/shush',
                text: `<@${testUserId}>`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await shushCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('reason is required');
        });

        it('should create a global ban and notify everyone', async () => {
            postEphemeralCalls = [];
            postMessageCalls = [];
            logInternalCalls = [];

            const reason = `Test shush reason ${testId}`;
            const payload = createMockCommandPayload({
                command: '/shush',
                text: `<@${testUserId}> ${reason}`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await shushCommand(payload as any);

            // Check ban was created
            const ban = await prisma.bans.findFirst({
                where: { user: testUserId },
            });
            expect(ban).not.toBeNull();
            expect(ban?.reason).toBe(reason);

            // Check DM to banned user
            expect(postMessageCalls.length).toBe(1);
            expect(postMessageCalls[0].channel).toBe(testUserId);
            expect(postMessageCalls[0].text).toContain('banned from talking');

            // Check ephemeral confirmation to admin
            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('shushed');

            // Check internal log
            expect(logInternalCalls.length).toBe(1);
            expect(logInternalCalls[0]).toContain('shushed');
        });
    });

    describe('listenForBannedUser', () => {
        it('should not act on messages from non-shushed users', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: 'UNOTSHUSHED',
                channel: testChannel,
                text: 'This should stay',
                ts: '1234567890.111111',
            });

            await listenForBannedUser(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should delete messages from shushed users in any channel', async () => {
            deleteMessageCalls = [];
            postEphemeralCalls = [];

            const messageTs = '1234567890.222222';
            const messageText = `Message from shushed user ${testId}`;

            const mockEvent = createMockMessageEvent({
                user: testUserId,
                channel: testChannel,
                text: messageText,
                ts: messageTs,
            });

            await listenForBannedUser(mockEvent);

            // Message should be deleted
            expect(deleteMessageCalls.length).toBe(1);
            expect(deleteMessageCalls[0].ts).toBe(messageTs);

            // User should get ephemeral with their message
            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('muted');
            expect(postEphemeralCalls[0].text).toContain(messageText);
        });

        it('should work across different channels', async () => {
            deleteMessageCalls = [];
            const differentChannel = 'CDIFFERENT';

            const mockEvent = createMockMessageEvent({
                user: testUserId,
                channel: differentChannel,
                text: 'Message in different channel',
                ts: '1234567890.333333',
            });

            await listenForBannedUser(mockEvent);

            expect(deleteMessageCalls.length).toBe(1);
            expect(deleteMessageCalls[0].channel).toBe(differentChannel);
        });

        it('should ignore bot messages', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: testUserId,
                channel: testChannel,
                text: 'Bot message',
                ts: '1234567890.444444',
                subtype: 'bot_message',
            });

            await listenForBannedUser(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });
    });

    describe('unshushCommand', () => {
        it('should reject non-admin users', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/unshush',
                text: `<@${testUserId}>`,
                user_id: 'UNOTADMIN',
                channel_id: testChannel,
            });

            await unshushCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('Only admins');
        });

        it('should require a user argument', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/unshush',
                text: '',
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await unshushCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('specify a user');
        });

        it('should remove ban and notify user', async () => {
            postMessageCalls = [];
            logInternalCalls = [];

            const payload = createMockCommandPayload({
                command: '/unshush',
                text: `<@${testUserId}>`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await unshushCommand(payload as any);

            // Ban should be removed
            const ban = await prisma.bans.findFirst({
                where: { user: testUserId },
            });
            expect(ban).toBeNull();

            // User should be notified
            expect(postMessageCalls.length).toBe(1);
            expect(postMessageCalls[0].channel).toBe(testUserId);
            expect(postMessageCalls[0].text).toContain('unshushed');

            // Should be logged
            expect(logInternalCalls.length).toBe(1);
            expect(logInternalCalls[0]).toContain('unshushed');
        });

        it('should not delete messages after unshush', async () => {
            deleteMessageCalls = [];

            const mockEvent = createMockMessageEvent({
                user: testUserId,
                channel: testChannel,
                text: 'Message after unshush',
                ts: '1234567890.555555',
            });

            await listenForBannedUser(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });
    });
});
