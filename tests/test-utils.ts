/**
 * Test utilities for Firehose bot testing
 */

import { env } from '../utils/index.js';
import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';

/**
 * Production channel IDs that must NEVER be used for testing
 */
const PRODUCTION_CHANNELS = ['G01DBHPLK25', 'C07FL3G62LF'];

/**
 * Checks if a channel ID is a production channel
 */
export function isProductionChannel(channelId: string): boolean {
    return PRODUCTION_CHANNELS.includes(channelId);
}

/**
 * Validates that the test environment is safe to run
 * Throws if any configured channel points to production
 */
export function validateTestEnvironment(): void {
    const mirrorChannel = env.MIRRORCHANNEL;
    const logChannel = env.SLACK_LOG_CHANNEL;

    if (mirrorChannel && isProductionChannel(mirrorChannel)) {
        throw new Error(
            `FATAL: MIRRORCHANNEL is set to production channel ${mirrorChannel}. ` +
                'Tests must NEVER run against production channels.'
        );
    }

    if (logChannel && isProductionChannel(logChannel)) {
        throw new Error(
            `FATAL: SLACK_LOG_CHANNEL is set to production channel ${logChannel}. ` +
                'Tests must NEVER run against production channels.'
        );
    }
}

/**
 * Gets the test channel ID from environment (uses MIRRORCHANNEL)
 * Validates that it's not a production channel
 */
export function getTestChannel(): string {
    const channel = env.MIRRORCHANNEL;
    if (!channel) {
        throw new Error('MIRRORCHANNEL environment variable is required for testing');
    }
    if (isProductionChannel(channel)) {
        throw new Error(
            `FATAL: MIRRORCHANNEL is set to production channel ${channel}. ` +
                'Tests must NEVER run against production channels.'
        );
    }
    return channel;
}

/**
 * Generates a random test identifier for tracking test messages
 */
export function generateTestId(): string {
    return `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Waits for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock Slack message event payload
 */
export function createMockMessageEvent(options: {
    user: string;
    channel: string;
    text: string;
    ts?: string;
    thread_ts?: string;
    subtype?: string;
}): SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs {
    const payload = {
        type: 'message' as const,
        user: options.user,
        channel: options.channel,
        text: options.text,
        ts: options.ts || `${Date.now() / 1000}`,
        ...(options.thread_ts && { thread_ts: options.thread_ts }),
        ...(options.subtype && { subtype: options.subtype }),
    };

    return {
        payload,
        event: payload,
        message: payload,
        body: {
            token: 'test-token',
            team_id: 'T12345',
            api_app_id: 'A12345',
            event: payload,
            type: 'event_callback',
            event_id: 'Ev12345',
            event_time: Math.floor(Date.now() / 1000),
        },
        say: async () => ({ ok: true }),
        client: {} as any,
        context: {
            botToken: env.SLACK_BOT_TOKEN,
            botId: 'B12345',
            botUserId: 'U12345',
            isEnterpriseInstall: false,
        },
        logger: console,
        ack: async () => {},
    } as unknown as SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs;
}

/**
 * Creates a mock Slack command payload
 */
export function createMockCommandPayload(options: {
    command: string;
    text: string;
    user_id: string;
    channel_id: string;
    trigger_id?: string;
}) {
    return {
        payload: {
            command: options.command,
            text: options.text,
            user_id: options.user_id,
            channel_id: options.channel_id,
            trigger_id: options.trigger_id || 'test-trigger-id',
            response_url: 'https://hooks.slack.com/test',
            team_id: 'T12345',
            team_domain: 'test',
            channel_name: 'test-channel',
            user_name: 'testuser',
        },
        ack: async () => {},
        respond: async () => {},
        client: {} as any,
        context: {
            botToken: env.SLACK_BOT_TOKEN,
            botId: 'B12345',
            botUserId: 'U12345',
            isEnterpriseInstall: false,
        },
        logger: console,
        say: async () => ({ ok: true }),
    };
}
