import type {
  AiModelState,
  AlertSeverity,
  BatteryState,
  ChannelReading,
  ChannelStats,
  LinkState,
  TelemetryReading,
  ThermalStatus,
} from '@/types';
import { THRESHOLDS } from './constants';

const EM_DASH = '\u2014';

export const EM = EM_DASH;

export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Magnitude of a possibly-absent reading.
 *
 * `Math.abs(null)` is `0`, which would render a missing power reading as a real
 * zero. This returns `null` instead so callers can guard before doing arithmetic.
 */
export function absOrNull(v: number | null | undefined): number | null {
  return isNum(v as number) ? Math.abs(v as number) : null;
}

/** Multiply a possibly-absent reading by a constant, preserving `null`. */
export function scaleOrNull(v: number | null | undefined, k: number): number | null {
  return isNum(v as number) ? (v as number) * k : null;
}

/** `a / b` where either side may be absent. Returns `null` unless both are real. */
export function ratioOrNull(a: number | null | undefined, b: number): number | null {
  if (!isNum(a as number) || !Number.isFinite(b) || b === 0) return null;
  return (a as number) / b;
}

/** Percentage progress 0..100 from a reading against a limit, or `null`. */
export function percentOf(v: number | null | undefined, limit: number): number | null {
  const r = ratioOrNull(v, limit);
  return r === null ? null : clamp(r * 100, 0, 100);
}

export function round(v: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/** Format a number for a metric tile. Returns the dash placeholder when there is no data. */
export function fmt(v: number | null | undefined, dp = 1, dash = EM): string {
  if (!isNum(v)) return dash;
  const n = v as number;
  return n.toFixed(dp);
}

/** Split value + unit for large metric typography. */
export function splitUnit(v: number | null | undefined, dp = 1): { value: string; unit: string } {
  if (!isNum(v)) return { value: EM, unit: '' };
  return { value: (v as number).toFixed(dp), unit: '' };
}

export function fmtInt(v: number | null | undefined, dash = EM): string {
  if (!isNum(v)) return dash;
  return Math.round(v as number).toLocaleString('en-US');
}

export function fmtCompact(v: number | null | undefined, dash = EM): string {
  if (!isNum(v)) return dash;
  const n = v as number;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${round(n / 1_000_000, 2)}M`;
  if (abs >= 1_000) return `${round(n / 1_000, 1)}k`;
  return String(round(n, 1));
}

export function fmtKwh(v: number | null | undefined, dp = 2, dash = EM): string {
  if (!isNum(v)) return dash;
  return (v as number).toFixed(dp);
}

export function fmtPower(v: number | null | undefined, dp = 0, dash = EM): string {
  if (!isNum(v)) return dash;
  const n = v as number;
  if (Math.abs(n) >= 1000) return `${round(n / 1000, 2)}`;
  return n.toFixed(dp);
}

export function fmtPowerUnit(v: number | null | undefined): string {
  if (!isNum(v)) return '';
  return Math.abs(v as number) >= 1000 ? 'kW' : 'W';
}

export function fmtTime(ts: string | number | null | undefined, dash = EM): string {
  if (ts == null) return dash;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return dash;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  });
}

export function fmtClock(ts: string | number | null | undefined, dash = EM): string {
  if (ts == null) return dash;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return dash;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function fmtDate(ts: string | number | null | undefined, dash = EM): string {
  if (ts == null) return dash;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return dash;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function fmtDateTime(ts: string | number | null | undefined, dash = EM): string {
  if (ts == null) return dash;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return dash;
  return `${fmtDate(ts)} · ${fmtClock(ts)} UTC`;
}

export function fmtDateTimeSec(ts: string | number | null | undefined, dash = EM): string {
  if (ts == null) return dash;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return dash;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })} ${fmtTime(ts)} UTC`;
}

export function fmtAgo(ts: string | number | null | undefined, now = Date.now()): string {
  if (ts == null) return EM;
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  if (!Number.isFinite(t)) return EM;
  const diff = Math.max(0, Math.round((now - t) / 1000));
  if (diff < 2) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
}

export function fmtDuration(seconds: number | null | undefined, dash = EM): string {
  if (!isNum(seconds) || (seconds as number) < 0) return dash;
  const s = Math.floor(seconds as number);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/* -------------------------------------------------------------------------- */
/* Domain derivations                                                         */
/* -------------------------------------------------------------------------- */

export function batteryMode(netPowerW: number, deadband = 8): BatteryState['mode'] {
  if (netPowerW > deadband) return 'charging';
  if (netPowerW < -deadband) return 'discharging';
  return 'idle';
}

export function thermalStatus(maxC: number | null | undefined): ThermalStatus {
  if (!isNum(maxC as number)) return 'normal';
  const v = maxC as number;
  if (v >= THRESHOLDS.thermal.critical) return 'critical';
  if (v >= THRESHOLDS.thermal.high) return 'high';
  if (v >= THRESHOLDS.thermal.warm) return 'warm';
  return 'normal';
}

export function anomalyState(score: number | null | undefined): AiModelState {
  if (!isNum(score as number)) return 'normal';
  const v = score as number;
  if (v >= THRESHOLDS.anomaly.critical) return 'anomaly';
  if (v >= THRESHOLDS.anomaly.warning) return 'warning';
  return 'normal';
}

export function linkStateFromAge(ageSeconds: number | null | undefined, onlineS = 10, delayedS = 30): LinkState {
  if (ageSeconds == null || !Number.isFinite(ageSeconds)) return 'unknown';
  if (ageSeconds <= onlineS) return 'online';
  if (ageSeconds <= delayedS) return 'delayed';
  return 'offline';
}

export const LINK_META: Record<LinkState, { label: string; tone: string; text: string }> = {
  online: { label: 'ONLINE', tone: 'bg-hydro-400', text: 'text-hydro-400' },
  delayed: { label: 'DELAYED', tone: 'bg-warn-400', text: 'text-warn-400' },
  offline: { label: 'OFFLINE', tone: 'bg-danger-400', text: 'text-danger-400' },
  unknown: { label: 'NO DATA', tone: 'bg-ink-500', text: 'text-ink-400' },
};

/** Maps a tone key onto its text-colour class. */
export function toneClass(tone: string): string {
  const map: Record<string, string> = {
    volt: 'text-volt-300',
    ion: 'text-ion-300',
    hydro: 'text-hydro-400',
    sun: 'text-sun-400',
    danger: 'text-danger-400',
    warn: 'text-warn-400',
    neutral: 'text-ink-300',
  };
  return map[tone] ?? map.neutral;
}

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: 'INFO',
  warning: 'WARNING',
  critical: 'CRITICAL',
};

/**
 * Colour ramp used by the thermal map and temperature chips.
 * An absent probe falls back to the neutral "no data" chip colour.
 */
export function thermalColor(t: number | null | undefined, min = 22, max = 78): string {
  if (!isNum(t as number)) return '#3a4257';
  const v = clamp(((t as number) - min) / (max - min), 0, 1);
  const stops: [number, [number, number, number]][] = [
    [0, [52, 211, 238]],
    [0.32, [96, 165, 250]],
    [0.58, [167, 139, 250]],
    [0.78, [251, 191, 36]],
    [1, [239, 68, 68]],
  ];
  let out: [number, number, number] = stops[0][1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (v >= p0 && v <= p1) {
      const f = (v - p0) / (p1 - p0 || 1);
      out = [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
      break;
    }
  }
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
}

export function channelStatsNull(): ChannelStats {
  return {
    voltageAvg: Number.NaN,
    voltagePeak: Number.NaN,
    voltageMin: Number.NaN,
    currentAvg: Number.NaN,
    currentPeak: Number.NaN,
    powerAvg: Number.NaN,
    powerPeak: Number.NaN,
    energyDelta: Number.NaN,
    samples: 0,
    activeRatio: Number.NaN,
  };
}

export function hasStats(s: ChannelStats | null | undefined): boolean {
  return !!s && s.samples > 0 && Number.isFinite(s.powerAvg);
}

export function readingOrNull(r: ChannelReading | null | undefined): ChannelReading | null {
  if (!r) return null;
  return r;
}

/** One CSV cell. `null`/`undefined`/NaN become an empty cell, never "NaN". */
export type CsvCell = string | number | null | undefined;

/** CSV helper shared by the data-history and report exports. */
export function toCsv(rows: CsvCell[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell == null ? '' : String(cell);
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(','),
    )
    .join('\n');
}

export function csvResponse(filename: string, rows: (string | number | null | undefined)[][]): Response {
  const body = toCsv(rows);
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Coerce an arbitrary stored value to a number, or `null` when it is absent,
 * non-numeric, or non-finite. Never substitutes a default — a fabricated `0` is
 * indistinguishable from a genuine zero-watt reading and would mislead an
 * operator. `null` is what the UI renders as `N/A`.
 */
export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Numeric coercion for internal maths where `null` must behave as zero. */
export function num(v: unknown, fallback = 0): number {
  return isNum(v) ? v : fallback;
}

/**
 * Temperature aggregates from the probes that actually reported.
 * Returns `null` when no probe is valid rather than averaging an empty set.
 */
export function summariseProbes(t1: number | null, t2: number | null, t3: number | null, t4: number | null) {
  const valid = [t1, t2, t3, t4].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) return { min: null, max: null, avg: null };
  return {
    min: Math.min(...valid),
    max: Math.max(...valid),
    avg: Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100,
  };
}

/**
 * Normalise an arbitrary MongoDB document into the strict reading shape.
 * Missing or invalid values become `null` so the UI shows `N/A`.
 */
export function normaliseReading(doc: Record<string, unknown>): TelemetryReading {
  const channel = (v: unknown): ChannelReading => {
    const o = (v ?? {}) as Record<string, unknown>;
    // `valid: false` means the firmware got a bad Modbus frame — treat every
    // field in that channel as unavailable rather than trusting the numbers.
    const valid = o.valid === false ? false : true;
    const n = (k: string) => (valid ? numOrNull(o[k]) : null);
    return {
      voltage: n('voltage'),
      current: n('current'),
      power: n('power'),
      energy: n('energy'),
      valid,
    };
  };
  const t = (doc.temperature ?? {}) as Record<string, unknown>;
  const ai = (doc.ai ?? {}) as Record<string, unknown>;
  const st = (doc.status ?? {}) as Record<string, unknown>;
  const rawTs = doc.timestamp ?? doc.ts ?? doc.createdAt;
  const ts = rawTs instanceof Date ? rawTs.toISOString() : String(rawTs ?? new Date().toISOString());

  const t1 = numOrNull(t.t1);
  const t2 = numOrNull(t.t2);
  const t3 = numOrNull(t.t3);
  const t4 = numOrNull(t.t4);
  const probes = summariseProbes(t1, t2, t3, t4);
  // Trust stored aggregates only when they are consistent with a valid probe set.
  const hasProbe = probes.avg !== null;

  return {
    deviceId: String(doc.deviceId ?? 'EV-001'),
    timestamp: ts,
    solar: channel(doc.solar),
    fuelCell: channel(doc.fuelCell ?? doc.fuel_cell),
    vehicle: channel(doc.vehicle ?? doc.battery ?? doc.load),
    temperature: {
      t1,
      t2,
      t3,
      t4,
      min: hasProbe ? numOrNull(t.min) ?? probes.min : null,
      max: hasProbe ? numOrNull(t.max) ?? probes.max : null,
      avg: hasProbe ? numOrNull(t.avg) ?? numOrNull(t.average) ?? probes.avg : null,
    },
    ai: {
      soc: numOrNull(ai.soc),
      range: numOrNull(ai.range),
      anomalyScore: numOrNull(ai.anomalyScore ?? ai.anomaly_score),
      anomaly: typeof ai.anomaly === 'boolean' ? ai.anomaly : undefined,
      modelVersion: typeof ai.modelVersion === 'string' ? ai.modelVersion : undefined,
      horizonS: numOrNull(ai.horizonS) ?? undefined,
      inferenceMs: numOrNull(ai.inferenceMs) ?? undefined,
      modelsActive: numOrNull(ai.modelsActive) ?? undefined,
    },
    battery: doc.battery ? normaliseBattery(doc.battery as Record<string, unknown>) : undefined,
    wifi: typeof doc.wifi === 'boolean' ? doc.wifi : null,
    deviceUptimeMs: numOrNull(doc.deviceUptimeMs),
    status: {
      sd: typeof st.sd === 'boolean' ? st.sd : null,
      cloud: typeof st.cloud === 'boolean' ? st.cloud : null,
    },
    meta: doc.meta as TelemetryReading['meta'],
  };
}

export function normaliseBattery(b: Record<string, unknown>): BatteryState {
  const pick = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    soc: pick(b.soc),
    mode: (['charging', 'discharging', 'idle'] as const).includes(b.mode as BatteryState['mode'])
      ? (b.mode as BatteryState['mode'])
      : 'idle',
    netPowerW: pick(b.netPowerW ?? b.net_power_w),
    condition: (['excellent', 'good', 'fair', 'poor'] as const).includes(b.condition as BatteryState['condition'])
      ? (b.condition as BatteryState['condition'])
      : 'good',
    healthPct: pick(b.healthPct ?? b.health_pct) || 96,
    cycles: pick(b.cycles),
    cellVoltage: pick(b.cellVoltage ?? b.cell_voltage) || THRESHOLDS.batteryVoltageNominal / 13,
    cellCount: pick(b.cellCount ?? b.cell_count) || 13,
  };
}
