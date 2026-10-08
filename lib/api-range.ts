import { resolveDaily, resolveRange } from './time-range';
import type { TimeRange } from '@/types';
import { EVISION_DEVICE_ID } from './env';

export function rangeFromParams(sp: URLSearchParams, fallback = '24h'): TimeRange {
  const key = sp.get('range') ?? fallback;
  if (key === 'daily' || key === 'weekly' || key === 'monthly') return resolveDaily(key);
  const from = sp.get('from');
  const to = sp.get('to');
  return resolveRange(key, from ? Number(from) : null, to ? Number(to) : null);
}

export function deviceFromParams(sp: URLSearchParams): string {
  return (sp.get('device') || '').trim() || EVISION_DEVICE_ID;
}

export function numParam(sp: URLSearchParams, key: string, fallback: number): number {
  const v = Number(sp.get(key));
  return Number.isFinite(v) ? v : fallback;
}
