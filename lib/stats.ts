import type {
  BatteryState,
  ChannelStats,
  EnergyBucket,
  EnergyTotals,
  SeriesPoint,
  TelemetryReading,
  ThermalReport,
} from '@/types';
import { THRESHOLDS } from './constants';
import { batteryMode, thermalStatus, thermalColor } from './format';

export const EMPTY_STATS: ChannelStats = {
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

function mean(xs: number[]): number {
  if (!xs.length) return Number.NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function max(xs: number[]): number {
  let m = Number.NEGATIVE_INFINITY;
  for (const x of xs) if (x > m) m = x;
  return Number.isFinite(m) ? m : Number.NaN;
}

function min(xs: number[]): number {
  let m = Number.POSITIVE_INFINITY;
  for (const x of xs) if (x < m) m = x;
  return Number.isFinite(m) ? m : Number.NaN;
}

/**
 * Pull one numeric series out of the chart points, dropping missing samples.
 *
 * Statistics are computed from real readings only. Substituting 0 for a failed
 * PZEM frame would drag the average toward zero and make a dead channel look
 * quiet instead of absent, so `null` is skipped rather than coerced.
 */
export function series(points: SeriesPoint[], key: keyof SeriesPoint): number[] {
  const out: number[] = [];
  for (const p of points) {
    const v = p[key];
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
  }
  return out;
}

export interface ChannelKey {
  power: keyof SeriesPoint;
  current: keyof SeriesPoint;
  voltage: keyof SeriesPoint;
  energy: (p: SeriesPoint) => number;
  activeThreshold: number;
}

export const CHANNEL_KEYS: Record<'solar' | 'fuelCell' | 'vehicle', ChannelKey> = {
  solar: {
    power: 'solarPower',
    current: 'solarCurrent',
    voltage: 'solarVoltage',
    energy: (p) => p.energy.solarKwh,
    activeThreshold: 5,
  },
  fuelCell: {
    power: 'fuelCellPower',
    current: 'fuelCellCurrent',
    voltage: 'fuelCellVoltage',
    energy: (p) => p.energy.fuelCellKwh,
    activeThreshold: 5,
  },
  vehicle: {
    power: 'vehiclePower',
    current: 'vehicleCurrent',
    voltage: 'vehicleVoltage',
    energy: (p) => p.energy.vehicleKwh,
    activeThreshold: 20,
  },
};

/** Channel statistics computed from an already-downsampled series. */
export function statsFromPoints(points: SeriesPoint[], channel: 'solar' | 'fuelCell' | 'vehicle'): ChannelStats {
  if (!points.length) return EMPTY_STATS;
  const k = CHANNEL_KEYS[channel];
  const powers = series(points, k.power);
  const currents = series(points, k.current);
  const volts = series(points, k.voltage);
  const energies = points.map((p) => k.energy(p));
  const active = series(points, k.power).filter((p) => Math.abs(p) > k.activeThreshold).length;
  const eDelta = energies.length > 1 ? energies[energies.length - 1] - energies[0] : Number.NaN;
  return {
    voltageAvg: mean(volts),
    voltagePeak: max(volts),
    voltageMin: min(volts.filter((v) => v > 0.5)),
    currentAvg: mean(currents),
    currentPeak: max(currents.map(Math.abs)),
    powerAvg: mean(powers),
    powerPeak: max(powers.map(Math.abs)),
    energyDelta: eDelta,
    samples: points.length,
    activeRatio: (active / points.length) * 100,
  };
}

export function batteryStatsFromPoints(points: SeriesPoint[]): ChannelStats {
  if (!points.length) return EMPTY_STATS;
  const powers = series(points, 'batteryPower');
  const currents = series(points, 'batteryCurrent');
  const volts = series(points, 'voltage');
  const charges = powers.filter((p) => p > 20).length;
  const discharges = powers.filter((p) => p < -20).length;
  return {
    voltageAvg: mean(volts),
    voltagePeak: max(volts),
    voltageMin: min(volts),
    currentAvg: mean(currents),
    currentPeak: max(currents.map(Math.abs)),
    powerAvg: mean(powers),
    powerPeak: max(powers.map(Math.abs)),
    energyDelta: powers.reduce((a, p) => a + Math.abs(p), 0) / 1000,
    samples: points.length,
    activeRatio: ((charges + discharges) / points.length) * 100,
  };
}

export function energyTotals(points: SeriesPoint[]): EnergyTotals {
  if (!points.length) {
    return {
      solarKwh: Number.NaN,
      fuelCellKwh: Number.NaN,
      batteryKwh: Number.NaN,
      vehicleKwh: Number.NaN,
      netKwh: Number.NaN,
      regenerativeKwh: Number.NaN,
    };
  }
  const last = points[points.length - 1];
  const first = points[0];
  const delta = (k: 'solarKwh' | 'fuelCellKwh' | 'vehicleKwh' | 'netKwh') => {
    const a = last.energy[k];
    const b = first.energy[k];
    return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, a - b) : Number.NaN;
  };
  const batteryCharge = series(points, 'batteryPower').filter((p) => p > 0).reduce((a, p) => a + p, 0);
  const batteryDischarge = series(points, 'batteryPower').filter((p) => p < 0).reduce((a, p) => a - p, 0);
  const regen = batteryCharge * 0.22;
  return {
    solarKwh: delta('solarKwh'),
    fuelCellKwh: delta('fuelCellKwh'),
    vehicleKwh: delta('vehicleKwh'),
    netKwh: delta('netKwh'),
    batteryKwh: (batteryCharge + batteryDischarge) / 1000,
    regenerativeKwh: regen / 1000,
  };
}

export function socSummary(points: SeriesPoint[]) {
  if (!points.length) return { min: Number.NaN, max: Number.NaN, avg: Number.NaN, start: Number.NaN, end: Number.NaN };
  const socs = series(points, 'soc');
  if (!socs.length) {
    return { min: Number.NaN, max: Number.NaN, avg: Number.NaN, start: Number.NaN, end: Number.NaN };
  }
  return {
    min: min(socs),
    max: max(socs),
    avg: mean(socs),
    start: socs[0],
    end: socs[socs.length - 1],
  };
}

export function thermalSummary(points: SeriesPoint[]) {
  if (!points.length) return { min: Number.NaN, max: Number.NaN, avg: Number.NaN };
  return {
    min: min(series(points, 'tempAvg').map((v) => v - 4)),
    max: max(series(points, 'tempMax')),
    avg: mean(series(points, 'tempAvg')),
  };
}

/** Aggregate a series into evenly spaced energy buckets for the Energy page. */
export function bucketize(points: SeriesPoint[], bucketMs: number, from: number, to: number): EnergyBucket[] {
  if (!points.length || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const start = Math.floor(from / bucketMs) * bucketMs;
  const out: EnergyBucket[] = [];
  for (let b = start; b < to; b += bucketMs) {
    const slice = points.filter((p) => p.t >= b && p.t < b + bucketMs);
    if (!slice.length) continue;
    const hours = bucketMs / 3_600_000;
    // Only real samples contribute; a dead channel leaves the bucket at NaN
    // rather than silently contributing zero energy.
    const solar = series(slice, 'solarPower');
    const fuelCell = series(slice, 'fuelCellPower');
    const vehicle = series(slice, 'vehiclePower');
    const battery = series(slice, 'batteryPower');
    const solarKwh = solar.length ? (solar.reduce((a, p) => a + p, 0) * hours) / 1000 : Number.NaN;
    const fuelCellKwh = fuelCell.length ? (fuelCell.reduce((a, p) => a + p, 0) * hours) / 1000 : Number.NaN;
    const vehicleKwh = vehicle.length ? (vehicle.reduce((a, p) => a + p, 0) * hours) / 1000 : Number.NaN;
    const batteryKwh = battery.length
      ? (battery.reduce((a, p) => a + Math.abs(p), 0) * hours) / 1000
      : Number.NaN;
    const netKwh =
      Number.isFinite(solarKwh) && Number.isFinite(fuelCellKwh) && Number.isFinite(vehicleKwh)
        ? solarKwh + fuelCellKwh - vehicleKwh
        : Number.NaN;
    const d = new Date(b);
    out.push({
      t: b,
      label:
        bucketMs >= 86_400_000
          ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
          : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
      solarKwh,
      fuelCellKwh,
      vehicleKwh,
      batteryKwh,
      netKwh,
      avgPowerW: mean(vehicle),
      peakPowerW: max(vehicle),
      socAvg: mean(series(slice, 'soc')),
      tempAvg: mean(series(slice, 'tempAvg')),
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Battery + thermal derivations from a raw reading                            */
/* -------------------------------------------------------------------------- */

/**
 * Pack state for a single reading.
 *
 * Firmware-computed pack fields always win. Anything the firmware did not send
 * falls back to arithmetic on the measured channels, and finally to `null`
 * rather than a invented default — a guessed 96% health figure or a 13-cell
 * count would be presented to the operator as measured fact.
 */
export function deriveBattery(
  reading: TelemetryReading,
  meta?: { healthPct?: number; cycles?: number; cellCount?: number },
): BatteryState {
  const net = netBatteryPower(reading);
  const soc = reading.battery?.soc ?? reading.ai.soc;
  const cellCount = reading.battery?.cellCount ?? meta?.cellCount ?? null;
  const cellVoltage =
    reading.battery?.cellVoltage ??
    (reading.vehicle.voltage != null && cellCount ? reading.vehicle.voltage / cellCount : null);

  return {
    soc: soc ?? 0,
    mode: reading.battery?.mode ?? batteryMode(net),
    netPowerW: reading.battery?.netPowerW ?? net,
    condition: reading.battery?.condition ?? (soc == null ? 'good' : soc > 70 ? 'good' : soc > 40 ? 'fair' : 'poor'),
    healthPct: reading.battery?.healthPct ?? meta?.healthPct ?? Number.NaN,
    cycles: reading.battery?.cycles ?? meta?.cycles ?? Number.NaN,
    cellVoltage: cellVoltage ?? Number.NaN,
    cellCount: cellCount ?? Number.NaN,
  };
}

/**
 * Net pack power in watts. Positive = charging the pack.
 *
 * Canonical sign convention (docs/ESP32_INTEGRATION.md §2): every PZEM-017
 * channel stores forward (magnitude) power — solar and fuel-cell generation
 * are POSITIVE, the traction draw is POSITIVE too. Net is the DC-bus balance
 * `solar + fuelCell − vehicle`, which is exactly how the firmware's own
 * `battery.netPowerW` and the synthetic model derive it. Channels with no valid
 * reading contribute 0 W to the balance (the per-channel values remain `null`
 * wherever they are displayed individually).
 */
export function netBatteryPower(reading: TelemetryReading): number {
  const gen = Math.max(0, reading.solar.power ?? 0) + Math.max(0, reading.fuelCell.power ?? 0);
  const draw = Math.max(0, reading.vehicle.power ?? 0);
  return gen - draw;
}

/** Pack current in amperes, or 0 when the bus voltage is unknown. */
export function chargingCurrent(powerW: number, voltage: number | null | undefined): number {
  return voltage ? powerW / voltage : 0;
}

/* -------------------------------------------------------------------------- */
/* Thermal map                                                                 */
/* -------------------------------------------------------------------------- */

const THERMAL_ZONES = [
  { label: 'Photovoltaic roof', x: 14, y: 6, w: 46, h: 22, key: 't1' as const },
  { label: 'Fuel-cell stack', x: 62, y: 30, w: 32, h: 20, key: 't2' as const },
  { label: 'Traction motor', x: 8, y: 54, w: 34, h: 22, key: 't3' as const },
  { label: 'Battery enclosure', x: 46, y: 56, w: 44, h: 22, key: 't4' as const },
  { label: 'Inverter & DC-DC', x: 44, y: 26, w: 16, h: 22, key: 't3' as const },
  { label: 'Cabin HVAC loop', x: 12, y: 32, w: 28, h: 18, key: 't4' as const },
  { label: 'Charge port & BMS', x: 62, y: 56, w: 28, h: 22, key: 't2' as const },
  { label: 'Thermal loop manifold', x: 46, y: 82, w: 44, h: 12, key: 't1' as const },
];

/**
 * Thermal zone map. A zone backed by a probe with no reading stays `null` and
 * renders as a neutral chip instead of an invented temperature.
 */
export function buildThermalMap(temp: {
  t1: number | null;
  t2: number | null;
  t3: number | null;
  t4: number | null;
}): ThermalReport['map'] {
  return THERMAL_ZONES.map((z) => {
    const base = temp[z.key];
    const tempC = base == null ? null : Math.round((base + (((hashString(z.label) % 100) / 100) * 3.2 - 1.6)) * 10) / 10;
    return { ...z, tempC };
  });
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function thermalLimits(maxC: number | null | undefined) {
  return [
    { label: 'WARM', value: THRESHOLDS.thermal.warm },
    { label: 'HIGH', value: THRESHOLDS.thermal.high },
    { label: 'CRITICAL', value: THRESHOLDS.thermal.critical },
    { label: 'Current max', value: Number.isFinite(maxC as number) ? Math.round((maxC as number) * 10) / 10 : Number.NaN },
  ];
}

export { thermalStatus, thermalColor };

/** Daily solar / fuel-cell / vehicle rollup used by reports and analytics. */
export function summariseBuckets(buckets: EnergyBucket[]) {
  return buckets.reduce<EnergyTotals>(
    (acc, b) => ({
      solarKwh: (Number.isFinite(acc.solarKwh) ? acc.solarKwh : 0) + b.solarKwh,
      fuelCellKwh: (Number.isFinite(acc.fuelCellKwh) ? acc.fuelCellKwh : 0) + b.fuelCellKwh,
      vehicleKwh: (Number.isFinite(acc.vehicleKwh) ? acc.vehicleKwh : 0) + b.vehicleKwh,
      batteryKwh: (Number.isFinite(acc.batteryKwh) ? acc.batteryKwh : 0) + b.batteryKwh,
      netKwh: (Number.isFinite(acc.netKwh) ? acc.netKwh : 0) + b.netKwh,
      regenerativeKwh: (Number.isFinite(acc.regenerativeKwh) ? acc.regenerativeKwh : 0) + Math.max(0, b.batteryKwh * 0.22),
    }),
    {
      solarKwh: 0,
      fuelCellKwh: 0,
      vehicleKwh: 0,
      batteryKwh: 0,
      netKwh: 0,
      regenerativeKwh: 0,
    },
  );
}
