import * as chrono from 'chrono-node';

export function parseDuration(args: string[]): { expiresAt: Date | null; remaining: string[] } {
    const joined = args.join(' ');
    const match = joined.match(/^<([^>]+)>\s*/);
    if (!match) return { expiresAt: null, remaining: args };

    const parsed = chrono.parseDate(match[1]);
    if (!parsed) return { expiresAt: null, remaining: args };

    const remaining = joined.slice(match[0].length).split(' ').filter(Boolean);
    return { expiresAt: parsed, remaining };
}

export function formatExpiry(expiresAt: Date): string {
    const ts = Math.floor(expiresAt.getTime() / 1000);
    return `<!date^${ts}^{date_long} at {time}|${expiresAt.toUTCString()}>`;
}

export async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    const workers = Array.from({ length: concurrency }, async () => {
        while (index < items.length) {
            const i = index++;
            results[i] = await fn(items[i]);
        }
    });

    await Promise.all(workers);
    return results;
}
