import type { TimeRange } from '@/types';

export const RANGE_PRESETS = [
  { key: '5m', label: '5 MIN', ms: 5 * 60 * 1000, points: 30 },
  { key: '15m', label: '15 MIN', ms: 15 * 60 * 1000, points: 45 },
  { key: '1h', label: '1 HOUR', ms: 60 * 60 * 1000, points: 60 },
  { key: '6h', label: '6 HOURS', ms: 6 * 60 * 60 * 1000, points: 90 },
  { key: '24h', label: '24 HOURS', ms: 24 * 60 * 60 * 1000, points: 96 },
  { key: '7d', label: '7 DAYS', ms: 7 * 24 * 60 * 60 * 1000, points: 112 },
  { key: '30d', label: '30 DAYS', ms: 30 * 24 * 60 * 60 * 1000, points: 120 },
] as const;

export type RangeKey = (typeof RANGE_PRESETS)[number]['key'] | 'custom';

export function resolveRange(
  key: string,
  customFrom?: string | number | null,
  customTo?: string | number | null,
): TimeRange {
  const to = Date.now();
  const preset = RANGE_PRESETS.find((p) => p.key === key);
  if (preset) {
    const from = to - preset.ms;
    return {
      key: preset.key,
      label: preset.label,
      from,
      to,
      bucketMs: Math.max(1000, Math.floor(preset.ms / preset.points)),
    };
  }
  const f = customFrom ? (typeof customFrom === 'number' ? customFrom : Date.parse(customFrom)) : to - 24 * 3600 * 1000;
  const t = customTo ? (typeof customTo === 'number' ? customTo : Date.parse(customTo)) : to;
  const from = Number.isFinite(f) ? f! : to - 24 * 3600 * 1000;
  const end = Number.isFinite(t) && t! > from ? t! : to;
  return {
    key: 'custom',
    label: 'CUSTOM',
    from,
    to: end,
    bucketMs: Math.max(1000, Math.floor((end - from) / 120)),
  };
}

export const DAILY_RANGES = [
  { key: 'daily', label: 'DAILY', ms: 24 * 60 * 60 * 1000, points: 24 },
  { key: 'weekly', label: 'WEEKLY', ms: 7 * 24 * 60 * 60 * 1000, points: 7 },
  { key: 'monthly', label: 'MONTHLY', ms: 30 * 24 * 60 * 60 * 1000, points: 30 },
] as const;

export function resolveDaily(key: string): TimeRange {
  const preset = DAILY_RANGES.find((p) => p.key === key) ?? DAILY_RANGES[0];
  const to = Date.now();
  return {
    key: preset.key,
    label: preset.label,
    from: to - preset.ms,
    to,
    bucketMs: Math.max(60_000, Math.floor(preset.ms / preset.points)),
  };
}

/** Compact axis formatter that adapts to the span being displayed. */
export function makeTimeFormatter(from: number, to: number): (t: number) => string {
  const span = Math.max(1, to - from);
  const d = new Date(from);
  if (span <= 3 * 3600 * 1000) {
    return (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }
  if (span <= 48 * 3600 * 1000) {
    return (t) =>
      `${d.toLocaleString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })} ${new Date(t)
        .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`;
  }
  return (t) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}
