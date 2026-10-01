import * as chrono from 'chrono-node';

const BARE_DURATION =
    /^\d+\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|month|months|y|yr|yrs|year|years)\b/i;

export function parseDuration(args: string[]): {
    expiresAt: Date | null;
    remaining: string[];
    error?: string;
} {
    const joined = args.join(' ');
    const match = joined.match(/^&lt;([^&]+)&gt;\s*/);
    if (!match) {
        if (BARE_DURATION.test(joined)) {
            return {
                expiresAt: null,
                remaining: args,
                error: 'Durations must be wrapped in angle brackets, e.g. `<2 days>`. Leave it out entirely to make this permanent.',
            };
        }
        return { expiresAt: null, remaining: args };
    }

    const input = match[1];
    const parsed = chrono.parseDate(input) ?? chrono.parseDate(`in ${input}`);
    if (!parsed)
        return { expiresAt: null, remaining: args, error: `Could not parse duration: "${input}"` };

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
