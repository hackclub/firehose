import { userClient, userAPI, isUserAPIAvailable, env } from '../../utils/index.js';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const PAGE_DELAY_MS = 1200;

const FALLBACK_ERRORS = new Set([
    'missing_scope',
    'not_allowed_token_type',
    'invalid_auth',
    'no_permission',
]);

export type SearchMatch = {
    channel: string;
    ts: string;
};

type Page = {
    matches: SearchMatch[];
    pages: number;
};

let useBrowserToken = false;

function normalize(matches: any[]): SearchMatch[] {
    const out: SearchMatch[] = [];
    for (const match of matches ?? []) {
        const channel = match?.channel?.id;
        const ts = match?.ts;
        if (typeof channel !== 'string' || typeof ts !== 'string') continue;
        if (!channel.startsWith('C') && !channel.startsWith('G')) continue;
        out.push({ channel, ts });
    }
    return out;
}

async function fetchPage(query: string, page: number): Promise<Page> {
    if (!useBrowserToken) {
        try {
            const res = await userClient.search.messages({
                query,
                count: PAGE_SIZE,
                page,
                sort: 'timestamp',
                sort_dir: 'desc',
            });
            return {
                matches: normalize(res.messages?.matches ?? []),
                pages: res.messages?.paging?.pages ?? 1,
            };
        } catch (e: any) {
            const code = e?.data?.error;
            if (!isUserAPIAvailable || !FALLBACK_ERRORS.has(code)) throw e;
            console.warn(`[nuke] search via OAuth token failed (${code}), using browser token`);
            useBrowserToken = true;
        }
    }

    const json = await userAPI('search.messages', {
        query,
        count: String(PAGE_SIZE),
        page: String(page),
        sort: 'timestamp',
        sort_dir: 'desc',
    });
    return {
        matches: normalize(json?.messages?.matches ?? []),
        pages: json?.messages?.paging?.pages ?? 1,
    };
}

export function isSearchAvailable(): boolean {
    return Boolean(env.SLACK_USER_TOKEN) || isUserAPIAvailable;
}

export async function searchUserMessages(user: string, since: Date): Promise<SearchMatch[]> {
    const afterDate = new Date(since.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const query = `from:<@${user}> after:${afterDate}`;
    const sinceSec = since.getTime() / 1000;

    const seen = new Set<string>();
    const results: SearchMatch[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
        const { matches, pages } = await fetchPage(query, page);

        let reachedCutoff = false;
        for (const match of matches) {
            if (parseFloat(match.ts) < sinceSec) {
                reachedCutoff = true;
                continue;
            }
            const key = `${match.channel}:${match.ts}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(match);
        }

        if (reachedCutoff || page >= pages || matches.length === 0) break;
        await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }

    return results;
}
