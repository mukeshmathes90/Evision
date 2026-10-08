import 'server-only';
import { deviceFromParams, rangeFromParams } from './api-range';
import type { TimeRange } from '@/types';

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Normalise Next.js 15 search params into a URLSearchParams instance. */
export function toSearchParams(sp: RawSearchParams): URLSearchParams {
  const map = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string' && value.length) map.set(key, value);
  }
  return map;
}

export function parseParams(sp: RawSearchParams, fallbackRange = '24h'): { device: string; range: TimeRange } {
  const map = toSearchParams(sp);
  return {
    device: deviceFromParams(map),
    range: rangeFromParams(map, fallbackRange),
  };
}

/** Query string that keeps the active device + window on client navigations. */
export function qs(device: string, range: TimeRange, extra: Record<string, string | number | undefined> = {}): string {
  const map = new URLSearchParams();
  map.set('device', device);
  map.set('range', range.key);
  if (range.key === 'custom') {
    map.set('from', String(range.from));
    map.set('to', String(range.to));
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== '') map.set(k, String(v));
  }
  return map.toString();
}