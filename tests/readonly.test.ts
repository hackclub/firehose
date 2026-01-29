/**
 * Tests for the read-only channel feature
 *
 * Actually tests the command handlers and listeners with mock events
 */

import { describe, it, expect, beforeAll, afterAll, spyOn } from 'bun:test';
import { getPrisma } from '../utils/index.js';
import * as utils from '../utils/index.js';
import readOnlyCommand from '../features/readonly/command.js';
import cleanupChannel from '../features/readonly/listener.js';
import {
    getTestChannel,
    generateTestId,
    createMockCommandPayload,
    createMockMessageEvent,
} from './test-utils.js';

const prisma = getPrisma();

describe('Read-Only Channel Feature', () => {
    const testChannel = getTestChannel();
    const readonlyChannelId = `CREADONLY${Date.now()}`;
    const adminUserId = `UADMIN${Date.now()}`;
    const regularUserId = `UREGULAR${Date.now()}`;
    const allowlistedUserId = `UALLOWED${Date.now()}`;
    let testId: string;

    let postEphemeralCalls: Array<{ channel: string; user: string; text: string }> = [];
    let logInternalCalls: string[] = [];
    let deleteMessageCalls: Array<{ channel: string; ts: string }> = [];

    beforeAll(() => {
        testId = generateTestId();

        spyOn(utils, 'postEphemeral').mockImplementation(async (channel, user, text) => {
            postEphemeralCalls.push({ channel, user, text });
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
    });

    afterAll(async () => {
        await prisma.channel.deleteMany({
            where: { id: readonlyChannelId },
        });
    });

    describe('readOnlyCommand', () => {
        it('should reject non-admin users', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/readonly',
                text: `<#${readonlyChannelId}>`,
                user_id: regularUserId,
                channel_id: testChannel,
            });

            await readOnlyCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('Only admins');
        });

        it('should require a channel argument', async () => {
            postEphemeralCalls = [];
            const payload = createMockCommandPayload({
                command: '/readonly',
                text: '',
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await readOnlyCommand(payload as any);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('give a channel');
        });

        it('should make a channel read-only', async () => {
            postEphemeralCalls = [];
            logInternalCalls = [];

            const payload = createMockCommandPayload({
                command: '/readonly',
                text: `<#${readonlyChannelId}>`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await readOnlyCommand(payload as any);

            // Check config was created
            const config = await prisma.channel.findFirst({
                where: { id: readonlyChannelId },
            });
            expect(config).not.toBeNull();
            expect(config?.readOnly).toBe(true);
            expect(config?.allowlist).toContain(adminUserId);

            // Check notifications
            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('read only');

            expect(logInternalCalls.length).toBe(1);
            expect(logInternalCalls[0]).toContain('read-only');
        });

        it('should toggle off read-only when called again', async () => {
            postEphemeralCalls = [];
            logInternalCalls = [];

            const payload = createMockCommandPayload({
                command: '/readonly',
                text: `<#${readonlyChannelId}>`,
                user_id: adminUserId,
                channel_id: testChannel,
            });

            await readOnlyCommand(payload as any);

            // Config should be deleted
            const config = await prisma.channel.findFirst({
                where: { id: readonlyChannelId },
            });
            expect(config).toBeNull();

            expect(postEphemeralCalls[0].text).toContain('no longer read only');
            expect(logInternalCalls[0]).toContain('no longer read-only');
        });
    });

    describe('cleanupChannel listener', () => {
        beforeAll(async () => {
            // Re-create readonly config for listener tests
            await prisma.channel.create({
                data: {
                    id: readonlyChannelId,
                    readOnly: true,
                    allowlist: [allowlistedUserId],
                },
            });
        });

        it('should not act on non-readonly channels', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: 'CNOTREADONLY',
                text: 'Message in normal channel',
                ts: '1234567890.111111',
            });

            await cleanupChannel(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should delete messages from regular users in readonly channels', async () => {
            deleteMessageCalls = [];
            postEphemeralCalls = [];

            const messageTs = '1234567890.222222';
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: readonlyChannelId,
                text: 'Unauthorized message',
                ts: messageTs,
            });

            await cleanupChannel(mockEvent);

            expect(deleteMessageCalls.length).toBe(1);
            expect(deleteMessageCalls[0].ts).toBe(messageTs);

            expect(postEphemeralCalls.length).toBe(1);
            expect(postEphemeralCalls[0].text).toContain('read-only');
        });

        it('should allow messages from admins', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: adminUserId,
                channel: readonlyChannelId,
                text: 'Admin message',
                ts: '1234567890.333333',
            });

            await cleanupChannel(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should allow messages from allowlisted users', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: allowlistedUserId,
                channel: readonlyChannelId,
                text: 'Allowlisted user message',
                ts: '1234567890.444444',
            });

            await cleanupChannel(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should allow thread replies (not broadcasts)', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: readonlyChannelId,
                text: 'Thread reply',
                ts: '1234567890.555555',
                thread_ts: '1234567890.000000',
            });

            await cleanupChannel(mockEvent);

            expect(deleteMessageCalls.length).toBe(0);
        });

        it('should delete thread broadcasts', async () => {
            deleteMessageCalls = [];
            const mockEvent = createMockMessageEvent({
                user: regularUserId,
                channel: readonlyChannelId,
                text: 'Thread broadcast',
                ts: '1234567890.666666',
                thread_ts: '1234567890.000000',
                subtype: 'thread_broadcast',
            });

            await cleanupChannel(mockEvent);

            expect(deleteMessageCalls.length).toBe(1);
        });
    });
});
