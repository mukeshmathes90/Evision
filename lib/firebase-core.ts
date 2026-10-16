/**
 * Shared Firebase Realtime Database read layer.
 *
 * No `server-only` guard: this module is imported by the server-side query
 * layer AND by the browser (live dashboard streams straight from Firebase).
 * The RTDB root URL is public (Firebase security rules protect writes), so it
 * is safe to ship. Never put credentials in here.
 *
 * Frame layout is discovered at runtime because the ESP32 writer may use any
 * of several sensible paths. `discoverLayout` probes known candidates, caches
 * the result for a short TTL, and records whether a path holds a single
 * "latest" frame or a map of frames.
 */

import type {
  ChannelStats,
  DeviceInfo,
  EnergyBucket,
  SeriesPoint,
  TelemetryReading,
} from '@/types';
import { normaliseReading } from './format';

export const FIREBASE_PROJECT_ID = 'evisionai-bca1c';
export const DEFAULT_FIREBASE_RTDB_URL = `https://${FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;

function resolveUrl(): string {
  // `process.env.NEXT_PUBLIC_FIREBASE_RTDB_URL` is statically replaced by
  // Next at build time, so this resolves identically in the server bundle and
  // the browser bundle. Non-public override and the hardcoded default provide
  // sensible fallbacks in plain Node.
  const publicUrl =
    typeof process !== 'undefined' && process?.env ? process.env.NEXT_PUBLIC_FIREBASE_RTDB_URL : '';
  const serverUrl = typeof process !== 'undefined' && process?.env ? process.env.FIREBASE_RTDB_URL : '';
  const chosen = publicUrl?.trim() || serverUrl?.trim() || DEFAULT_FIREBASE_RTDB_URL;
  return stripTrailing(chosen);
}

export const FIREBASE_RTDB_URL = resolveUrl();

/** Candidate paths for a device's telemetry, tried in order on first read. */
export function layoutCandidates(deviceId: string): string[] {
  return [
    `ev_monitoring/${deviceId}/history`,
    `ev_monitoring/${deviceId}`,
    `ev_monitoring/${deviceId}/frames`,
    `telemetry/${deviceId}`,
    `${deviceId}/telemetry`,
    `devices/${deviceId}/telemetry`,
    `telemetry/${deviceId}/frames`,
    `${deviceId}/telemetry/frames`,
    `devices/${deviceId}/telemetry/frames`,
    `frames/${deviceId}`,
    `telemetry`,
    'latest',
    deviceId,
  ];
}

export function stripTrailing(s: string): string {
  return s.replace(/\/+$/, '');
}

function stripLeading(s: string): string {
  return s.replace(/^\/+/, '');
}

export function firebaseUrl(path: string): string {
  return `${FIREBASE_RTDB_URL}/${stripLeading(path)}.json`;
}

/** A fetched RTDB value may be null, a single frame, or a map of frames. */
export interface ResolvedLayout {
  /** Path (relative to the DB root) that holds the device's frames. */
  root: string;
  /** `latest` → the node holds one frame; `frames` → a map keyed by push id/ts. */
  kind: 'latest' | 'frames';
}

function looksLikeFrame(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (!o.solar && !o.fuelCell && !o.vehicle) return false;
  return 'timestamp' in o || ('temperature' in o || 'ai' in o) || 'deviceId' in o;
}

function looksLikeFrameMap(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const values = Object.values(v as Record<string, unknown>);
  if (!values.length) return false;
  return values.some(looksLikeFrame);
}

/** Throw a normalised error for any failed RTDB round-trip. */
export async function firebaseGetJson(path: string, timeoutMs = 8000): Promise<Record<string, unknown> | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(firebaseUrl(path), {
      signal: ac.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Firebase request failed with status ${res.status}`);
    const text = await res.text();
    if (!text.trim() || text.trim() === 'null') return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    const reason = (err as Error).name === 'AbortError' ? 'timed out' : (err as Error).message;
    throw new Error(`Firebase Realtime Database unreachable (${reason}).`);
  } finally {
    clearTimeout(timer);
  }
}

let layoutCache: { deviceId: string; at: number; layout: ResolvedLayout } | null = null;
const LAYOUT_TTL_MS = 30_000;

/**
 * Discover which RTDB path holds the device's frames. Tries candidates in
 * order; falls back to the device telemetry path so the dashboard keeps
 * working (empty state) even when the node has never written.
 */
export async function discoverLayout(deviceId: string): Promise<ResolvedLayout> {
  if (layoutCache && layoutCache.deviceId === deviceId && Date.now() - layoutCache.at < LAYOUT_TTL_MS) {
    return layoutCache.layout;
  }
  let resolved: ResolvedLayout | null = null;
  for (const cand of layoutCandidates(deviceId)) {
    let value: Record<string, unknown> | null;
    try {
      value = await firebaseGetJson(cand);
    } catch {
      // A path may be protected or missing; keep probing candidates.
      continue;
    }
    if (value == null) continue;
    if (looksLikeFrame(value)) {
      resolved = { root: cand, kind: 'latest' };
      break;
    }
    if (looksLikeFrameMap(value)) {
      resolved = { root: cand, kind: 'frames' };
      break;
    }
  }
  const layout = resolved ?? { root: `telemetry/${deviceId}`, kind: 'frames' };
  layoutCache = { deviceId, at: Date.now(), layout };
  return layout;
}

let framesCache: { deviceId: string; at: number; frames: TelemetryReading[] } | null = null;
const FRAMES_TTL_MS = 1_500;

/** Fetch and normalise every persisted frame for a device, ascending by time. */
export async function fetchFrames(
  deviceId: string,
  opts: { force?: boolean; timeoutMs?: number } = {},
): Promise<TelemetryReading[]> {
  const now = Date.now();
  if (!opts.force && framesCache && framesCache.deviceId === deviceId && now - framesCache.at < FRAMES_TTL_MS) {
    return framesCache.frames;
  }
  const layout = await discoverLayout(deviceId);
  const value = await firebaseGetJson(layout.root, opts.timeoutMs ?? 8000);
  let docs: unknown[];
  if (value == null) {
    docs = [];
  } else if (layout.kind === 'latest') {
    docs = [value];
  } else if (looksLikeFrameMap(value)) {
    const entries = Object.entries(value);
    const wrapped = entries.some(([, v]) => Array.isArray(v));
    if (wrapped) docs = entries.flatMap(([, v]) => (Array.isArray(v) ? (v as unknown[]) : [v]));
    else docs = entries.map(([, v]) => v);
  } else if (Array.isArray(value)) {
    docs = value;
  } else {
    docs = [value];
  }

  const raw = docs
    .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object' && !Array.isArray(d))
    .map((d) => normaliseReading(d))
    .filter((f) => Number.isFinite(Date.parse(f.timestamp)));
  raw.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const frames = raw;
  framesCache = { deviceId, at: Date.now(), frames };
  return frames;
}

export function pickLatest(frames: TelemetryReading[]): TelemetryReading | null {
  return frames.length ? frames[frames.length - 1] : null;
}

/* -------------------------------------------------------------------------- */
/* Aggregations (mirror the MongoDB aggregation pipelines in lib/queries.ts)   */
/* -------------------------------------------------------------------------- */

function num0(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

function lastVal(list: TelemetryReading[], pick: (f: TelemetryReading) => number | null | undefined): number {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const v = pick(list[i]);
    if (Number.isFinite(v as number)) return v as number;
  }
  return NaN;
}

function firstVal(list: TelemetryReading[], pick: (f: TelemetryReading) => number | null | undefined): number {
  for (let i = 0; i < list.length; i += 1) {
    const v = pick(list[i]);
    if (Number.isFinite(v as number)) return v as number;
  }
  return NaN;
}

function maxVal(list: TelemetryReading[], pick: (f: TelemetryReading) => number | null | undefined): number {
  let m = NaN;
  for (const f of list) {
    const v = pick(f);
    if (Number.isFinite(v as number)) m = Number.isNaN(m) ? (v as number) : Math.max(m, v as number);
  }
  return m;
}

function avgVal(list: TelemetryReading[], pick: (f: TelemetryReading) => number | null | undefined): number {
  let sum = 0;
  let n = 0;
  for (const f of list) {
    const v = pick(f);
    if (Number.isFinite(v as number)) {
      sum += v as number;
      n += 1;
    }
  }
  return n ? sum / n : NaN;
}

export function framesToSeries(
  frames: TelemetryReading[],
  from: number,
  to: number,
  points = 120,
): SeriesPoint[] {
  const span = Math.max(1000, to - from);
  const bucketMs = Math.max(1000, Math.floor(span / points));
  const inWindow = frames.filter((f) => {
    const t = Date.parse(f.timestamp);
    return Number.isFinite(t) && t >= from && t <= to;
  });
  const byBucket = new Map<number, TelemetryReading[]>();
  for (const f of inWindow) {
    const t = Date.parse(f.timestamp);
    const b = t - (t % bucketMs);
    const arr = byBucket.get(b);
    if (arr) arr.push(f);
    else byBucket.set(b, [f]);
  }
  const keys = [...byBucket.keys()].sort((a, b) => a - b);
  const out: SeriesPoint[] = [];
  for (const bk of keys) {
    const list = byBucket.get(bk)!;
    const vv = num0(avgVal(list, (f) => f.vehicle.voltage));
    const bp = num0(avgVal(list, (f) => f.battery?.netPowerW));
    const se0 = firstVal(list, (f) => f.solar.energy);
    const se1 = lastVal(list, (f) => f.solar.energy);
    const fe0 = firstVal(list, (f) => f.fuelCell.energy);
    const fe1 = lastVal(list, (f) => f.fuelCell.energy);
    const ve0 = firstVal(list, (f) => f.vehicle.energy);
    const ve1 = lastVal(list, (f) => f.vehicle.energy);
    const diffE = (a: number, b: number) => (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0);
    const solarKwh = diffE(se1, se0);
    const fuelCellKwh = diffE(fe1, fe0);
    const vehicleKwh = diffE(ve1, ve0);
    out.push({
      t: bk,
      solarPower: num0(avgVal(list, (f) => f.solar.power)),
      fuelCellPower: num0(avgVal(list, (f) => f.fuelCell.power)),
      vehiclePower: Math.max(0, num0(avgVal(list, (f) => f.vehicle.power))),
      batteryPower: bp,
      solarCurrent: num0(avgVal(list, (f) => f.solar.current)),
      fuelCellCurrent: num0(avgVal(list, (f) => f.fuelCell.current)),
      vehicleCurrent: num0(avgVal(list, (f) => f.vehicle.current)),
      batteryCurrent: vv ? bp / vv : 0,
      voltage: vv,
      solarVoltage: num0(avgVal(list, (f) => f.solar.voltage)),
      fuelCellVoltage: num0(avgVal(list, (f) => f.fuelCell.voltage)),
      vehicleVoltage: vv,
      soc: num0(lastVal(list, (f) => f.ai.soc)),
      range: num0(lastVal(list, (f) => f.ai.range)),
      anomalyScore: num0(maxVal(list, (f) => f.ai.anomalyScore)),
      t1: num0(avgVal(list, (f) => f.temperature.t1)),
      t2: num0(avgVal(list, (f) => f.temperature.t2)),
      t3: num0(avgVal(list, (f) => f.temperature.t3)),
      t4: num0(avgVal(list, (f) => f.temperature.t4)),
      tempAvg: num0(avgVal(list, (f) => f.temperature.avg)),
      tempMax: num0(maxVal(list, (f) => f.temperature.max)),
      energy: {
        solarKwh,
        fuelCellKwh,
        batteryKwh: Math.abs(bp) / 1000,
        vehicleKwh,
        netKwh: solarKwh + fuelCellKwh - vehicleKwh,
        regenerativeKwh: 0,
      },
    });
  }
  return out;
}

function inWindow(frames: TelemetryReading[], from: number, to: number): TelemetryReading[] {
  return frames.filter((f) => {
    const t = Date.parse(f.timestamp);
    return Number.isFinite(t) && t >= from && t <= to;
  });
}

function fin(v: number): number {
  return Number.isFinite(v) ? v : Number.NaN;
}

/** Channel statistics computed from raw frames (mirrors `getChannelSummary`). */
export function frameSummary(
  frames: TelemetryReading[],
  from: number,
  to: number,
): Record<'solar' | 'fuelCell' | 'vehicle', ChannelStats> {
  const list = inWindow(frames, from, to);
  const n = list.length;
  const ch = (key: 'solar' | 'fuelCell' | 'vehicle', activeAbove: number): ChannelStats => {
    const pSum = list.reduce((a, f) => a + (Number(f[key].power) || 0), 0);
    const vSum = list.reduce((a, f) => a + (Number(f[key].voltage) || 0), 0);
    const cSum = list.reduce((a, f) => a + (Number(f[key].current) || 0), 0);
    const pAct = list.filter((f) => Math.abs(Number(f[key].power) || 0) > activeAbove).length;
    const pMax = list.reduce((a, f) => Math.max(a, Math.abs(Number(f[key].power) || 0)), 0);
    const vMax = list.reduce((a, f) => Math.max(a, Number(f[key].voltage) || 0), 0);
    const vMin = list.reduce((a, f) => {
      const v = Number(f[key].voltage) || 0;
      return v > 0.5 ? Math.min(a, v) : a;
    }, 9999);
    const cMax = list.reduce((a, f) => Math.max(a, Math.abs(Number(f[key].current) || 0)), 0);
    return {
      voltageAvg: fin(n ? vSum / n : NaN),
      voltagePeak: fin(vMax),
      voltageMin: fin(vMin),
      currentAvg: fin(n ? cSum / n : NaN),
      currentPeak: fin(cMax),
      powerAvg: fin(n ? pSum / n : NaN),
      powerPeak: fin(pMax),
      energyDelta: Number.NaN,
      samples: n,
      activeRatio: fin(n ? (pAct / n) * 100 : NaN),
    };
  };
  return {
    solar: ch('solar', 5),
    fuelCell: ch('fuelCell', 5),
    vehicle: ch('vehicle', 20),
  };
}

/** Energy rollup buckets from raw frames (mirrors `getEnergyBuckets`). */
export function framesToEnergyBuckets(
  frames: TelemetryReading[],
  from: number,
  to: number,
  bucketMs: number,
): EnergyBucket[] {
  const list = inWindow(frames, from, to);
  const byBucket = new Map<number, TelemetryReading[]>();
  for (const f of list) {
    const t = Date.parse(f.timestamp);
    const b = t - (t % bucketMs);
    const arr = byBucket.get(b);
    if (arr) arr.push(f);
    else byBucket.set(b, [f]);
  }
  const keys = [...byBucket.keys()].sort((a, b) => a - b);
  const hours = bucketMs / 3_600_000;
  const label = (t: number) =>
    new Date(t).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: bucketMs >= 86_400_000 ? undefined : '2-digit',
      minute: bucketMs >= 86_400_000 ? undefined : '2-digit',
      timeZone: 'UTC',
    });
  return keys.map((bk) => {
    const l = byBucket.get(bk)!;
    const solarPower = num0(avgVal(l, (f) => f.solar.power));
    const fuelCellPower = num0(avgVal(l, (f) => f.fuelCell.power));
    const vehiclePower = num0(avgVal(l, (f) => f.vehicle.power));
    const bpSum = l.reduce((a, f) => a + (Math.abs(Number(f.battery?.netPowerW ?? 0)) || 0), 0);
    const solarKwh = (solarPower * hours) / 1000;
    const fuelCellKwh = (fuelCellPower * hours) / 1000;
    const vehicleKwh = (vehiclePower * hours) / 1000;
    const batteryKwh = (bpSum * hours) / 1000;
    return {
      t: bk,
      label: label(bk),
      solarKwh,
      fuelCellKwh,
      vehicleKwh,
      batteryKwh,
      netKwh: solarKwh + fuelCellKwh - vehicleKwh,
      avgPowerW: num0(avgVal(l, (f) => f.vehicle.power)),
      peakPowerW: maxVal(l, (f) => f.vehicle.power),
      socAvg: num0(avgVal(l, (f) => f.ai.soc)),
      tempAvg: num0(avgVal(l, (f) => f.temperature.avg)),
    };
  });
}

/** Build a DeviceInfo descriptor from the persisted frames (no devices node). */
export function buildDeviceInfo(deviceId: string, frames: TelemetryReading[]): DeviceInfo {
  const latest = pickLatest(frames);
  const ts = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
  return {
    deviceId,
    name: latest?.meta?.firmware ? 'EVISION Reference Vehicle' : deviceId,
    model: 'EVISION Edge Node EN-3',
    mcu: 'ESP32-S3 N16R8',
    firmware: latest?.meta?.firmware ?? 'unknown',
    location: 'Powered by Firebase Realtime Database',
    status: latest ? 'online' : 'offline',
    lastSeen: ts(latest?.timestamp),
    registeredAt: new Date(latest ? Date.parse(latest.timestamp) : 0).toISOString(),
    channels: [
      { id: 'pzem-1', label: 'SOLAR PZEM', address: '0x01', role: 'SOLAR', state: latest ? 'connected' : 'no-data', lastReading: ts(latest?.timestamp) },
      { id: 'pzem-2', label: 'FUEL CELL PZEM', address: '0x02', role: 'FUEL_CELL', state: latest ? 'connected' : 'no-data', lastReading: ts(latest?.timestamp) },
      { id: 'pzem-3', label: 'LOAD PZEM', address: '0x03', role: 'LOAD', state: latest ? 'connected' : 'no-data', lastReading: ts(latest?.timestamp) },
    ],
    temperatureSensors: 4,
    storage: 'sd-card',
    aiModels: ['soc-prediction', 'range-prediction', 'anomaly-detection'],
  };
}



