/**
 * Tests for the channel ban/unban feature
 *
 * Actually tests the command handlers and listeners with mock events
 */

import { describe, it, expect, beforeAll, afterAll, mock, spyOn } from 'bun:test';
import { getPrisma } from '../utils/index.js';
import * as utils from '../utils/index.js';
import channelBanCommand from '../features/channel_ban/command.js';
import unbanCommand from '../features/channel_ban/unban.js';
import {
    getTestChannel,
    generateTestId,
    createMockCommandPayload,
    createMockMessageEvent,
} from './test-utils.js';

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

const { default: listenForChannelBannedUser } =
    await import('../features/channel_ban/listener.js');

const prisma = getPrisma();

describe('Channel Ban Feature', () => {
    const testChannel = getTestChannel();
    const testUserId = `UCHANBAN${Date.now()}`;
    const adminUserId = `UADMIN${Date.now()}`;
    let testId: string;

    // Track calls for verification
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
        await prisma.user.deleteMany({
            where: { user: testUserId },
        });
    });

    describe('channelBanCommand', () => {
        beforeAll(() => {
            postEphemeralCalls = [];
            postMessageCalls = [];
            logInternalCalls = [];
        });

        it('should reject non-admin users', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/channelban',
                text: `<@${testUserId}> <#${testChannel}> test reason`,
                user_id: 'UNOTADMIN',
                channel_id: testChannel,
            });

            await channelBanCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('Only admins');
        });

        it('should require a user argument (note: source code has a bug with empty input)', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/channelban',
                text: 'not-a-user <#C123> reason',
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await channelBanCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('user is required');
        });

        it('should require a channel argument', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/channelban',
                text: `<@${testUserId}> not-a-channel reason`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await channelBanCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('channel is required');
        });

        it('should require a reason', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/channelban',
                text: `<@${testUserId}> <#${testChannel}>`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await channelBanCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('reason is required');
        });

        it('should create a ban and notify user when all args provided', async () => {
            postEphemeralCalls = [];
            postMessageCalls = [];
            logInternalCalls = [];

            const reason = `Test ban reason ${testId}`;
            const payload = createMockCommandPayload({
                command: '/channelban',
                text: `<@${testUserId}> <#${testChannel}> ${reason}`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await channelBanCommand(payload as any);

            // Check ban was created in database
            const ban = await prisma.user.findFirst({
                where: { user: testUserId, channel: testChannel },
            });
            expect(ban).not.toBeNull();
            expect(ban?.reason).toBe(reason);

            // Check notifications were sent
            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('has been banned');

            expect(postMessageCalls.length).toBe(1);
            expect(postMessageCalls[0].channel).toBe(testUserId);
            expect(postMessageCalls[0].text).toContain('banned from');

            expect(logInternalCalls.length).toBe(1);
            expect(logInternalCalls[0]).toContain('banned');
        });
    });

    describe('listenForChannelBannedUser', () => {
        beforeAll(() => {
            deleteMessageCalls = [];
            postEphemeralCalls = [];
        });

        it('should not act on messages from non-banned users', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: 'UNOTBANNED',
                channel: testChannel,
                text: 'This should not be deleted',
                ts: '1234567890.111111',
            });

            await listenForChannelBannedUser(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should delete messages and notify banned user', async () => {
            deleteMessageCalls = [];
            postEphemeralCalls = [];

            const messageTs = '1234567890.222222';
            const messageText = `Test message from banned user ${testId}`;

            const mockEvent = createMockMessageEvent({
                user: testUserId,
                channel: testChannel,
                text: messageText,
                ts: messageTs,
            });

            await listenForChannelBannedUser(mockEvent);

            // Check message was deleted
            expect(deleteMessageCalls.length).toBe(1);
            expect(deleteMessageCalls[0].ts).toBe(messageTs);

            // Check ephemeral was sent to user
            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].user).toBe(testUserId);
            expect(postEphemeralCalls[0].text).toContain('deleted');
            expect(postEphemeralCalls[0].text).toContain(messageText);
        });

        it('should ignore bot messages', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: testUserId,
                channel: testChannel,
                text: 'Bot message',
                ts: '1234567890.333333',
                subtype: 'bot_message',
            });

            await listenForChannelBannedUser(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });
    });

    describe('unbanCommand', () => {
        beforeAll(() => {
            postMessageCalls = [];
            logInternalCalls = [];
        });

        it('should reject non-admin users', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/channelunban',
                text: `<@${testUserId}> <#${testChannel}>`,
                user_id: 'UNOTADMIN',
                channel_id: testChannel,
            });

            await unbanCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('Only admins');
        });

        it('should require both user and channel arguments', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/channelunban',
                text: `<@${testUserId}> not-a-channel`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await unbanCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('Invalid arguments');
        });

        it('should remove ban and notify user', async () => {
            postMessageCalls = [];
            logInternalCalls = [];

            const payload = createMockCommandPayload({
                command: '/channelunban',
                text: `<@${testUserId}> <#${testChannel}>`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await unbanCommand(payload as any);

            // Check ban was removed
            const ban = await prisma.user.findFirst({
                where: { user: testUserId, channel: testChannel },
            });
            expect(ban).toBeNull();

            // Check notifications
            expect(postMessageCalls.length).toBe(1);
            expect(postMessageCalls[0].channel).toBe(testUserId);
            expect(postMessageCalls[0].text).toContain('unbanned');

            expect(logInternalCalls.length).toBe(1);
            expect(logInternalCalls[0]).toContain('unbanned');
        });
    });
});
