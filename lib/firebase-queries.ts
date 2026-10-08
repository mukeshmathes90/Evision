import 'server-only';
import {
  buildDeviceInfo,
  fetchFrames,
  frameSummary,
  framesToEnergyBuckets,
  framesToSeries,
  pickLatest,
} from './firebase-core';
import type {
  AiTimelineEvent,
  AlertRecord,
  ChannelStats,
  DeviceInfo,
  EnergyBucket,
  SeriesPoint,
  TelemetryReading,
  TripRecord,
} from '@/types';

/**
 * Server-side data access — Firebase Realtime Database backed.
 *
 * Mirrors the function surface `lib/data.ts` consumes. Telemetry reads throw
 * when Firebase is unreachable so the gateway can set the honest
 * "database unreachable" empty state; auxiliary datasets (alerts, trips,
 * events) have no Firebase collection yet and return empty rather than
 * fabricating data.
 */

function num0(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/* -------------------------------------------------------------------------- */
/* Device fleet                                                                */
/* -------------------------------------------------------------------------- */

export async function listDevices(): Promise<DeviceInfo[]> {
  const deviceId = 'EV-001';
  const frames = await fetchFrames(deviceId);
  if (!frames.length) return [];
  return [buildDeviceInfo(deviceId, frames)];
}

export async function getDevice(deviceId: string): Promise<DeviceInfo | null> {
  const frames = await fetchFrames(deviceId);
  return buildDeviceInfo(deviceId, frames);
}

/* -------------------------------------------------------------------------- */
/* Telemetry core reads                                                        */
/* -------------------------------------------------------------------------- */

export async function getLatestReading(deviceId: string): Promise<TelemetryReading | null> {
  const frames = await fetchFrames(deviceId);
  return pickLatest(frames);
}

export async function getRecentReadings(deviceId: string, limit = 60): Promise<TelemetryReading[]> {
  const frames = await fetchFrames(deviceId);
  return frames.slice(-Math.min(limit, 500));
}

export async function getSeries(
  deviceId: string,
  from: number,
  to: number,
  points = 120,
): Promise<SeriesPoint[]> {
  const frames = await fetchFrames(deviceId);
  return framesToSeries(frames, from, to, points);
}

export async function getChannelSummary(
  deviceId: string,
  from: number,
  to: number,
): Promise<Record<'solar' | 'fuelCell' | 'vehicle', ChannelStats>> {
  const frames = await fetchFrames(deviceId);
  return frameSummary(frames, from, to);
}

export async function getEnergyBuckets(
  deviceId: string,
  from: number,
  to: number,
  bucketMs: number,
): Promise<EnergyBucket[]> {
  const frames = await fetchFrames(deviceId);
  return framesToEnergyBuckets(frames, from, to, bucketMs);
}

export async function getEnergyTotalsFromSessions(): Promise<null> {
  return null;
}

/* -------------------------------------------------------------------------- */
/* Alerts / trips / events (no Firebase collections yet → honest empty)        */
/* -------------------------------------------------------------------------- */

export interface AlertQuery {
  deviceId: string;
  from: number;
  to: number;
  severity?: string[];
  category?: string[];
  status?: string[];
  search?: string;
  limit?: number;
}

export async function getAlerts(_q: AlertQuery): Promise<AlertRecord[]> {
  return [];
}

export async function getDerivedAlerts(): Promise<AlertRecord[]> {
  return [];
}

export async function getTrips(_deviceId: string, _from: number, _to: number, _limit = 60): Promise<TripRecord[]> {
  return [];
}

export async function getTrip(deviceId: string, tripId: string): Promise<TripRecord | null> {
  void deviceId;
  void tripId;
  return null;
}

export async function getSystemEvents(_deviceId: string, _limit = 20): Promise<{ id: string; timestamp: string; type: string; severity: string; message: string; detail: string }[]> {
  return [];
}

/* -------------------------------------------------------------------------- */
/* AI predictions derived from the edge telemetry frame                        */
/* -------------------------------------------------------------------------- */

const AI_FIELD: Record<'soc' | 'range' | 'anomaly', (f: TelemetryReading) => number | null> = {
  soc: (f) => f.ai.soc,
  range: (f) => f.ai.range,
  anomaly: (f) => f.ai.anomalyScore,
};

export async function getAiSeries(
  deviceId: string,
  model: 'soc' | 'range' | 'anomaly',
  from: number,
  to: number,
  points = 80,
) {
  const frames = await fetchFrames(deviceId);
  const inWindow = frames.filter((f) => {
    const t = Date.parse(f.timestamp);
    return Number.isFinite(t) && t >= from && t <= to;
  });
  const step = Math.max(1, Math.floor(inWindow.length / Math.max(1, points * 6)));
  const rows: Record<string, number | string>[] = [];
  for (let i = 0; i < inWindow.length; i += step) {
    const f = inWindow[i];
    const value = AI_FIELD[model](f);
    if (!Number.isFinite(value as number)) continue;
    rows.push({
      t: Date.parse(f.timestamp),
      value: num0(value),
      baseline: 0,
      confidence: 0,
      latencyMs: num0(f.ai.inferenceMs),
      state: 'normal',
      timestamp: f.timestamp,
    });
  }
  return rows;
}

export async function getAiLatest(deviceId: string, model: 'soc' | 'range' | 'anomaly') {
  const frames = await fetchFrames(deviceId);
  const latest = pickLatest(frames);
  if (!latest) return null;
  const value = AI_FIELD[model](latest);
  if (!Number.isFinite(value as number)) return null;
  return {
    timestamp: latest.timestamp,
    prediction: num0(value),
    baseline: 0,
    confidence: 0,
    latencyMs: num0(latest.ai.inferenceMs),
    state: 'normal',
  };
}

export async function getAiTimeline(_deviceId: string, _from: number, _to: number, _limit = 30): Promise<AiTimelineEvent[]> {
  return [];
}

/* -------------------------------------------------------------------------- */
/* Telemetry table                                                             */
/* -------------------------------------------------------------------------- */

export interface TelemetryTableQuery {
  deviceId: string;
  from: number;
  to: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  search?: string;
}

const VALUE_OF: Record<string, (f: TelemetryReading) => number | null> = {
  timestamp: (f) => Date.parse(f.timestamp),
  soc: (f) => f.ai.soc,
  power: (f) => f.vehicle.power,
  voltage: (f) => f.vehicle.voltage,
  current: (f) => f.vehicle.current,
  range: (f) => f.ai.range,
  t1: (f) => f.temperature.t1,
  t2: (f) => f.temperature.t2,
  t3: (f) => f.temperature.t3,
  t4: (f) => f.temperature.t4,
};

export async function getTelemetryTable(q: TelemetryTableQuery) {
  const frames = await fetchFrames(q.deviceId);
  let rows = frames.filter((f) => {
    const t = Date.parse(f.timestamp);
    return Number.isFinite(t) && t >= q.from && t <= q.to;
  });
  if (q.search) {
    const s = q.search.toLowerCase();
    const asNum = Number(q.search);
    if (Number.isFinite(asNum)) {
      rows = rows.filter((f) => f.ai.soc != null && Math.abs(f.ai.soc - asNum) <= 0.75);
    } else {
      rows = rows.filter((f) => f.deviceId.toLowerCase().includes(s));
    }
  }
  const dir = q.sortDir === 'asc' ? 1 : -1;
  const get = VALUE_OF[q.sortBy] ?? VALUE_OF.timestamp;
  rows = [...rows].sort((a, b) => dir * (num0(get(a)) - num0(get(b))));
  const total = rows.length;
  const start = Math.max(0, (q.page - 1) * q.pageSize);
  return {
    rows: rows.slice(start, start + q.pageSize),
    total,
    page: q.page,
    pageSize: q.pageSize,
    pages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/* -------------------------------------------------------------------------- */
/* Counts                                                                      */
/* -------------------------------------------------------------------------- */

export async function getCounts(deviceId: string) {
  const frames = await fetchFrames(deviceId);
  const since = Date.now() - 30 * 86_400_000;
  const telemetry = frames.filter((f) => Date.parse(f.timestamp) >= since).length;
  return { telemetry, alerts: 0, trips: 0 };
}