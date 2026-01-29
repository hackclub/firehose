/**
 * Tests for utility helper functions
 */

import { describe, it, expect } from 'bun:test';
import { runWithConcurrency } from '../utils/helpers.js';
import { getThreadLink } from '../utils/logging.js';
import { validateTestEnvironment } from './test-utils.js';

describe('Helper Utilities', () => {
    describe('runWithConcurrency', () => {
        it('should process all items', async () => {
            const items = [1, 2, 3, 4, 5];
            const results: number[] = [];

            await runWithConcurrency(items, 2, async (item) => {
                results.push(item * 2);
                return item * 2;
            });

            expect(results).toHaveLength(5);
            expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
        });

        it('should respect concurrency limit', async () => {
            const concurrent: number[] = [];
            let maxConcurrent = 0;

            const items = [1, 2, 3, 4, 5, 6];
            await runWithConcurrency(items, 2, async (item) => {
                concurrent.push(item);
                maxConcurrent = Math.max(maxConcurrent, concurrent.length);
                await new Promise((r) => setTimeout(r, 10));
                concurrent.splice(concurrent.indexOf(item), 1);
                return item;
            });

            expect(maxConcurrent).toBeLessThanOrEqual(2);
        });

        it('should return results in original order', async () => {
            const items = [3, 1, 4, 1, 5, 9];
            const results = await runWithConcurrency(items, 3, async (item) => {
                await new Promise((r) => setTimeout(r, Math.random() * 20));
                return item * 10;
            });

            expect(results).toEqual([30, 10, 40, 10, 50, 90]);
        });

        it('should handle empty array', async () => {
            const results = await runWithConcurrency([], 5, async (item) => item);
            expect(results).toEqual([]);
        });

        it('should handle single item', async () => {
            const results = await runWithConcurrency([42], 10, async (item) => item * 2);
            expect(results).toEqual([84]);
        });
    });

    describe('getThreadLink', () => {
        it('should generate correct thread link', () => {
            const channel = 'C12345678';
            const ts = '1234567890.123456';

            const link = getThreadLink(channel, ts);

            expect(link).toBe('https://hackclub.slack.com/archives/C12345678/p1234567890123456');
        });

        it('should remove the dot from timestamp in the message ID portion', () => {
            const link = getThreadLink('CABC123', '1609459200.000100');

            // The path portion (after archives/) should not contain a dot
            const pathPart = link.split('/archives/')[1];
            expect(pathPart).not.toContain('.');
            expect(link).toContain('p1609459200000100');
        });
    });
});
