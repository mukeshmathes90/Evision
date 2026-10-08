import { THRESHOLDS } from './constants';
import type { BatteryState, SeriesPoint, TelemetryReading } from '@/types';
import { batteryMode, ratioOrNull, thermalStatus } from './format';

/* ========================================================================== */
/* Deterministic pseudo-random engine                                         */
/* ========================================================================== */

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 PRNG — small, fast, fully deterministic for a given seed. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseCache = new Map<string, number>();

function noise(seed: string): number {
  const hit = noiseCache.get(seed);
  if (hit !== undefined) return hit;
  const v = mulberry32(hashSeed(seed))();
  if (noiseCache.size < 200_000) noiseCache.set(seed, v);
  return v;
}

function noiseRange(seed: string, min: number, max: number): number {
  return min + noise(seed) * (max - min);
}

/** Smooth value noise in [0,1] over a 1-D domain — used for cloud cover / duty. */
function smoothNoise(seed: string, x: number, period: number): number {
  const p = x / period;
  const i = Math.floor(p);
  const f = p - i;
  const a = noise(`${seed}#${i}`);
  const b = noise(`${seed}#${i + 1}`);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

/** The instant the synthetic dataset was generated. All demo math anchors here. */
export const DEMO_NOW = Date.parse('2026-10-06T14:30:00.000Z');
const STEP_MS = 900_000; // 15-minute integration step
const DAY_MS = 86_400_000;

/* ========================================================================== */
/* Physical constants of the reference vehicle                                */
/* ========================================================================== */

const BATTERY_CAPACITY_WH = 5300; // 13S × 40 Ah × 10.2 V usable pack
const SOLAR_PEAK_W = 1980; // 4 × 500 W modules
const SOLAR_AREA_M2 = 8.2;
const FUEL_CELL_RATED_W = 1500;

/** Cloud-cover multiplier — 0.08 (clear) .. 1.0 (overcast), plus showers. */
function cloudFactor(deviceId: string, t: number): number {
  const day = Math.floor(t / DAY_MS);
  const hourOfDay = (t % DAY_MS) / 3_600_000;
  const cloudiness = smoothNoise(`${deviceId}:cloud`, day * 24 + hourOfDay, 9);
  const shower = smoothNoise(`${deviceId}:shower`, day * 48 + hourOfDay * 2, 3.2);
  return Math.max(0.06, Math.min(1, 0.08 + cloudiness * 0.92)) * (shower > 0.86 ? 0.74 : 1);
}

/** Clear-sky × cloud plane-of-array irradiance in W/m². */
function irradiance(deviceId: string, t: number): number {
  const hour = (t % DAY_MS) / 3_600_000;
  const sr = 6.1;
  const ss = 18.9;
  if (hour <= sr || hour >= ss) return 0;
  const x = (hour - sr) / (ss - sr);
  return 1000 * Math.pow(Math.sin(Math.PI * x), 1.35) * cloudFactor(deviceId, t);
}

/**
 * Cheap analytic SOC proxy. It is *not* the reported SOC — it only shapes the
 * duty profile (how hard the fuel cell and the driver work) so that the
 * integrated SOC curve below has the right character without recursion.
 */
function socCycle(deviceId: string, t: number): number {
  const hourOfDay = (t % DAY_MS) / 3_600_000;
  const day = Math.floor(t / DAY_MS);
  const diurnal = Math.sin(((hourOfDay - 8.5) / 24) * Math.PI * 2);
  const drift = (smoothNoise(`${deviceId}:socdrift`, day, 11) - 0.5) * 9;
  const anchor = 62 + noise(`${deviceId}:socAnchor`) * 6;
  return Math.max(6, Math.min(100, anchor - diurnal * 17 + drift));
}

function solarW(deviceId: string, t: number): number {
  return Math.min(SOLAR_PEAK_W, irradiance(deviceId, t) * SOLAR_AREA_M2 * 0.92);
}

/** Fuel-cell stack output — slow to ramp, plateaus near rated power. */
function fuelCellW(deviceId: string, t: number, socProxy: number): number {
  const minute = Math.floor(t / 60_000);
  const wantSoc = socProxy < 22 ? 92 : socProxy < 38 ? 76 : socProxy < 55 ? 60 : socProxy < 74 ? 47 : 36;
  const mission = smoothNoise(`${deviceId}:fcmission`, minute / 240, 5);
  const duty = wantSoc * (0.55 + mission * 0.75);
  const jitter = 1 + (noise(`${deviceId}:fcjit:${minute}`) - 0.5) * 0.06;
  const w = Math.max(0, Math.min(FUEL_CELL_RATED_W, duty * jitter));
  if (w < 30) return 0;
  return w * (1 - 0.11 * (w / FUEL_CELL_RATED_W)); // mild output sag
}

/** Traction demand from a commuting / urban-delivery duty profile. */
function vehicleLoadW(deviceId: string, t: number, socProxy: number): number {
  const hour = (t % DAY_MS) / 3_600_000;
  const seg = smoothNoise(`${deviceId}:duty`, Math.floor(t / 900_000), 5.5);
  const drive =
    (hour > 7.0 && hour < 9.6) ||
    (hour > 11.0 && hour < 12.6) ||
    (hour > 14.0 && hour < 15.4) ||
    (hour > 17.4 && hour < 20.2);
  const idle = 90 + noise(`${deviceId}:idle:${Math.floor(t / 30_000)}`) * 60;
  if (!drive) return Math.round(idle * 0.95);
  const cruise = 240 + seg * 620;
  const accel = Math.pow(noise(`${deviceId}:acc:${Math.floor(t / 45_000)}`), 2.4) * 2050;
  const hill = smoothNoise(`${deviceId}:hill`, Math.floor(t / 1_200_000), 9) * 320;
  const derate = socProxy < 12 ? 0.72 : 1;
  return Math.max(0, Math.round((cruise + accel + hill) * 0.95 * derate));
}

/* ========================================================================== */
/* SOC integration (memoised ladder — O(1) amortised)                          */
/* ========================================================================== */

interface SocLadder {
  index: number;
  soc: number;
}

const ladders = new Map<string, SocLadder>();

function anchorSoc(deviceId: string): number {
  return 62 + noise(`${deviceId}:socAnchor`) * 6;
}

function stepDeltaWh(deviceId: string, t: number, socProxy: number): number {
  return (solarW(deviceId, t) + fuelCellW(deviceId, t, socProxy) - vehicleLoadW(deviceId, t, socProxy)) * (STEP_MS / 3_600_000);
}

function socAt(deviceId: string, t: number): number {
  const idx = Math.floor(t / STEP_MS);
  const anchorIdx = Math.floor(DEMO_NOW / STEP_MS);
  let lad = ladders.get(deviceId);

  if (!lad) {
    lad = { index: anchorIdx, soc: anchorSoc(deviceId) };
    ladders.set(deviceId, lad);
  }

  if (idx > lad.index) {
    for (let s = lad.index; s < idx; s += 1) {
      const ts = s * STEP_MS;
      lad.soc += (stepDeltaWh(deviceId, ts, socCycle(deviceId, ts)) / BATTERY_CAPACITY_WH) * 100;
      lad.soc = Math.max(4, Math.min(100, lad.soc));
    }
    lad.index = idx;
  } else if (idx < lad.index) {
    for (let s = lad.index; s > idx; s -= 1) {
      const ts = (s - 1) * STEP_MS;
      lad.soc -= (stepDeltaWh(deviceId, ts, socCycle(deviceId, ts)) / BATTERY_CAPACITY_WH) * 100;
      lad.soc = Math.max(4, Math.min(100, lad.soc));
    }
    lad.index = idx;
  }
  return lad.soc;
}

/* ========================================================================== */
/* Pack model                                                                  */
/* ========================================================================== */

const BATTERY_R_INTERNAL = 0.021; // Ω effective pack + cabling

function packVoltage(soc: number, batteryW: number, t: number): number {
  const socTerm = 44.6 + soc * 0.155;
  const loadTerm = -Math.min(5.2, Math.abs(batteryW) / 900);
  const ripple = (noise(`ripple:${Math.floor(t / 2_000)}`) - 0.5) * 0.34;
  return Math.max(38, Math.min(60, socTerm + loadTerm + ripple));
}

function packCondition(deviceId: string) {
  const cycles = 180 + (hashSeed(`${deviceId}:soh`) % 640);
  const healthPct = Math.max(88, Math.min(99, 100 - cycles * 0.021));
  const condition: BatteryState['condition'] =
    healthPct >= 96 ? 'excellent' : healthPct >= 92 ? 'good' : healthPct >= 89 ? 'fair' : 'poor';
  return { cycles, healthPct: Math.round(healthPct * 10) / 10, condition };
}

function tempAt(base: number, loadW: number, t: number, tag: string): number {
  const heat = Math.min(16, Math.abs(loadW) / 118);
  const wobble = (noise(`${tag}:${Math.floor(t / 120_000)}`) - 0.5) * 1.5;
  const ambient = 24 + 7 * Math.pow(Math.max(0, Math.sin((Math.PI * (t % DAY_MS)) / DAY_MS)), 0.7);
  return Math.round((base + heat + wobble + ambient) * 10) / 10;
}

/** Anomaly score: base noise plus physically motivated excursions. */
export function anomalyScore(deviceId: string, t: number, maxTemp: number, soc: number): number {
  const base = 0.012 + noise(`${deviceId}:anom:${Math.floor(t / 30_000)}`) * 0.05;
  const thermalTerm = Math.max(0, (maxTemp - 46) / 34);
  const socTerm = Math.max(0, (14 - soc) / 14) * 0.18;
  const fault = noise(`${deviceId}:fault:${Math.floor(t / 120_000)}`) > 0.965 ? 0.62 : 0;
  return Math.round(Math.min(1, base + thermalTerm * 0.6 + socTerm + fault) * 1000) / 1000;
}

/* ========================================================================== */
/* The single deterministic sample                                             */
/* ========================================================================== */

/**
 * A synthetic channel always carries real numbers.
 *
 * The demo generator is a pure function that always produces a value, so it
 * models the "channel is present" case rather than the "sensor is absent" case.
 * Using the nullable `ChannelReading` here would force hundreds of `?? 0`
 * fallbacks through the demo layer and hide genuine bugs in the live path.
 */
export interface SyntheticChannel {
  voltage: number;
  current: number;
  power: number;
  energy: number;
  valid: true;
}

export interface SyntheticTemperature {
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  min: number;
  max: number;
  avg: number;
}

export interface SyntheticAi {
  soc: number;
  range: number;
  anomalyScore: number;
  horizonS: number;
  inferenceMs: number;
  modelsActive: number;
  modelVersion: string;
}

export interface SyntheticSample {
  deviceId: string;
  timestamp: string;
  t: number;
  solar: SyntheticChannel;
  fuelCell: SyntheticChannel;
  vehicle: SyntheticChannel;
  battery: BatteryState;
  temperature: SyntheticTemperature;
  ai: SyntheticAi;
  wifi: boolean;
  status: { sd: boolean; cloud: boolean };
  deviceUptimeMs: number;
  meta: NonNullable<TelemetryReading['meta']>;
}

/**
 * Build a fully self-consistent telemetry sample for an arbitrary instant.
 * Every field is a pure function of `(deviceId, t)`, so the demo dataset
 * behaves like a real recording: energy counters accumulate, SOC integrates the
 * power balance, thermal state lags power and the anomaly score correlates with
 * actual excursions.
 */
export function sampleAt(deviceId: string, t: number): SyntheticSample {
  const soc = Math.round(socAt(deviceId, t) * 10) / 10;

  const sw = solarW(deviceId, t);
  const solarV = sw > 8 ? 47.9 + noise(`sv:${Math.floor(t / 60_000)}`) * 3.4 : 0;
  const solarI = sw > 8 ? sw / solarV : 0;

  const fcW = fuelCellW(deviceId, t, socCycle(deviceId, t));
  const fcV = fcW > 8 ? 47.2 + noise(`fv:${Math.floor(t / 60_000)}`) * 2.6 : 0;
  const fcI = fcW > 8 ? fcW / fcV : 0;

  const loadW = vehicleLoadW(deviceId, t, soc);
  const batteryW = sw + fcW - loadW; // >0 charging, <0 discharging
  const packV = packVoltage(soc, batteryW, t);
  const packI = batteryW / packV;
  const vehV = packV - Math.abs(packI) * BATTERY_R_INTERNAL;
  const vehI = packI;
  const vehW = vehV * vehI;

  const { cycles, healthPct, condition } = packCondition(deviceId);

  const t1 = tempAt(1.5, sw, t, `${deviceId}:t1`);
  const t2 = tempAt(2.4, fcW * 1.4, t, `${deviceId}:t2`);
  const t3 = tempAt(3.1, vehW, t, `${deviceId}:t3`);
  const t4 = tempAt(2.0, batteryW, t, `${deviceId}:t4`);
  const vals = [t1, t2, t3, t4];
  const temperature = {
    t1,
    t2,
    t3,
    t4,
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: Math.round((vals.reduce((a, b) => a + b, 0) / 4) * 10) / 10,
  };

  const anomaly = anomalyScore(deviceId, t, temperature.max, soc);
  const eff = 15.2 + smoothNoise(`${deviceId}:eff`, Math.floor(t / 600_000), 6) * 5.4;
  const range = Math.round(soc * eff * 10) / 10;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const r1 = (v: number) => Math.round(v * 10) / 10;

  return {
    deviceId,
    timestamp: new Date(t).toISOString(),
    t,
    solar: { voltage: r2(solarV), current: r2(solarI), power: r1(sw), energy: Math.round(((t / 3_600_000) * sw * 0.86) / 10) / 100, valid: true },
    fuelCell: {
      voltage: r2(fcV),
      current: r2(fcI),
      power: r1(fcW),
      energy: Math.round(((t / 3_600_000) * fcW * 0.88) / 10) / 100,
      valid: true,
    },
    vehicle: {
      voltage: r2(vehV),
      current: r2(vehI),
      power: r1(vehW),
      energy: Math.round(((t / 3_600_000) * Math.max(0, loadW)) / 10) / 100,
      valid: true,
    },
    battery: {
      soc,
      mode: batteryMode(batteryW),
      netPowerW: r1(batteryW),
      condition,
      healthPct,
      cycles,
      cellVoltage: Math.round((packV / 13) * 1000) / 1000,
      cellCount: 13,
    },
    temperature,
    ai: {
      soc,
      range,
      anomalyScore: anomaly,
      horizonS: 180,
      inferenceMs: Math.round((3.6 + noise(`inf:${Math.floor(t / 30_000)}`) * 5.4) * 100) / 100,
      modelsActive: 7,
      modelVersion: 'evision-edge-1.4.2',
    },
    wifi: true,
    status: { sd: true, cloud: true },
    deviceUptimeMs: (Math.floor((t % DAY_MS) / 1000) + 86_400 * 42) * 1000,
    meta: {
      firmware: 'evision-edge-1.4.2',
      ip: '192.168.1.44',
      rssi: -46 - Math.round(noise(`rssi:${Math.floor(t / 60_000)}`) * 26),
      uptimeS: Math.floor((t % DAY_MS) / 1000) + 86_400 * 42,
      freeHeap: 268_000 + Math.round(noise(`heap:${Math.floor(t / 30_000)}`) * 90_000),
      sdFreeMb: 14_800 - ((t / DAY_MS) % 1) * 12,
      mqttTopic: `evision/${deviceId}/telemetry`,
    },
  };
}

/* ========================================================================== */
/* Series generation                                                           */
/* ========================================================================== */

export function buildSeries(deviceId: string, from: number, to: number, target = 120): SyntheticSample[] {
  const span = Math.max(1000, to - from);
  const count = Math.max(4, Math.min(600, target));
  const step = span / (count - 1);
  const out: SyntheticSample[] = [];
  for (let i = 0; i < count; i += 1) out.push(sampleAt(deviceId, Math.round(from + i * step)));
  return out;
}

export function seriesToPoints(samples: SyntheticSample[]): SeriesPoint[] {
  return samples.map((s) => ({
    t: s.t,
    solarPower: s.solar.power,
    fuelCellPower: s.fuelCell.power,
    vehiclePower: Math.max(0, s.vehicle.power),
    batteryPower: s.battery.netPowerW,
    solarCurrent: s.solar.current,
    fuelCellCurrent: s.fuelCell.current,
    vehicleCurrent: s.vehicle.current,
    batteryCurrent: ratioOrNull(s.battery.netPowerW, s.vehicle.voltage || 1),
    voltage: s.vehicle.voltage,
    solarVoltage: s.solar.voltage,
    fuelCellVoltage: s.fuelCell.voltage,
    vehicleVoltage: s.vehicle.voltage,
    soc: s.battery.soc,
    range: s.ai.range,
    anomalyScore: s.ai.anomalyScore,
    t1: s.temperature.t1,
    t2: s.temperature.t2,
    t3: s.temperature.t3,
    t4: s.temperature.t4,
    tempAvg: s.temperature.avg,
    tempMax: s.temperature.max,
    energy: {
      solarKwh: s.solar.energy,
      fuelCellKwh: s.fuelCell.energy,
      batteryKwh: Math.abs(s.battery.netPowerW) / 1000,
      vehicleKwh: s.vehicle.energy,
      netKwh: s.solar.energy + s.fuelCell.energy - s.vehicle.energy,
      regenerativeKwh: 0,
    },
  }));
}

/* ========================================================================== */
/* Aggregate helpers shared by the live + demo query layer                     */
/* ========================================================================== */

export function thermalFromSample(s: SyntheticSample) {
  return {
    min: s.temperature.min,
    max: s.temperature.max,
    avg: s.temperature.avg,
    status: thermalStatus(s.temperature.max),
  };
}

export function emptySample(deviceId: string, t: number): SyntheticSample {
  return sampleAt(deviceId, t);
}

export { THRESHOLDS, noiseRange, DAY_MS, BATTERY_CAPACITY_WH, SOLAR_PEAK_W, FUEL_CELL_RATED_W };
