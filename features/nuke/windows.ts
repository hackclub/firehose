export type NukeWindow = {
    value: string;
    label: string;
    ms: number;
};

const HOUR_MS = 60 * 60 * 1000;

export const NUKE_WINDOWS: NukeWindow[] = [
    { value: '1h', label: 'Last hour', ms: HOUR_MS },
    { value: '6h', label: 'Last 6 hours', ms: 6 * HOUR_MS },
    { value: '24h', label: 'Last 24 hours', ms: 24 * HOUR_MS },
    { value: '7d', label: 'Last 7 days', ms: 7 * 24 * HOUR_MS },
];

export function getWindow(value: string): NukeWindow | undefined {
    return NUKE_WINDOWS.find((w) => w.value === value);
}
