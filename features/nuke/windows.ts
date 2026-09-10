export const RETENTION_DAYS = 7;

export type NukeWindow = {
    value: string;
    label: string;
    ms: number;
};

export const NUKE_WINDOWS: NukeWindow[] = [
    { value: '1h', label: 'Last hour', ms: 60 * 60 * 1000 },
    { value: '6h', label: 'Last 6 hours', ms: 6 * 60 * 60 * 1000 },
    { value: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
    { value: '7d', label: 'Last 7 days', ms: RETENTION_DAYS * 24 * 60 * 60 * 1000 },
];

export function getWindow(value: string): NukeWindow | undefined {
    return NUKE_WINDOWS.find((w) => w.value === value);
}
