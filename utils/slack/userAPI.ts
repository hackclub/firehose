import { env } from '../env.js';

export const isUserAPIAvailable = Boolean(env.SLACK_BROWSER_TOKEN && env.SLACK_COOKIE);

if (!isUserAPIAvailable) {
    console.warn(
        'Warning: SLACK_BROWSER_TOKEN or SLACK_COOKIE not set. Slack User API calls will not be used.'
    );
}

export async function userAPI(method: string, params: Record<string, string>) {
    if (!isUserAPIAvailable) {
        throw new Error(
            'Slack User API calls are not enabled because SLACK_BROWSER_TOKEN or SLACK_COOKIE is missing.'
        );
    }
    if (!env.SLACK_BROWSER_TOKEN || !env.SLACK_COOKIE) {
        throw new Error('Missing SLACK_BROWSER_TOKEN or SLACK_COOKIE in environment variables');
    }

    const url = new URL(`/api/${method}`, 'https://slack.com');
    const formData = new FormData();
    formData.set('token', env.SLACK_BROWSER_TOKEN);
    for (const [name, value] of Object.entries(params)) {
        formData.set(name, value);
    }

    // console.log('Fetching Slack user API:', url.toString(), 'with params:', params)
    const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
            Cookie: `d=${encodeURIComponent(env.SLACK_COOKIE)};`,
        },
    });

    if (!response.ok) {
        try {
            const text = await response.text();
            console.error('Failed to fetch Slack user API, fail text:', response.status, text);
        } catch {}
        throw new Error('Failed to fetch Slack user API, fail: ' + response.statusText);
    }
    const json = (await response.json()) as { ok: boolean } & Record<string, any>;
    if (!json.ok) {
        console.error('Failed to fetch Slack user API, json:', json);
        throw new Error('Failed to fetch Slack user API, json: ' + JSON.stringify(json));
    }

    return json;
}
