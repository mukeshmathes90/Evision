import type {
  AiModelReport,
  AiTimelineEvent,
  AlertRecord,
  DeviceInfo,
  EnergyBucket,
  LinkState,
  OverviewPayload,
  SeriesPoint,
  TelemetryReading,
  ThermalReport,
  TripRecord,
} from '@/types';
import { AI_MODELS, ALERT_RULES, HARDWARE, THRESHOLDS } from './constants';
import { anomalyState, fmt, thermalStatus } from './format';
import {
  batteryStatsFromPoints,
  bucketize,
  buildThermalMap,
  deriveBattery,
  energyTotals,
  series,
  socSummary,
  statsFromPoints,
  summariseBuckets,
  thermalLimits,
  thermalSummary,
} from './stats';
import {
  buildSeries,
  DEMO_NOW,
  sampleAt,
  seriesToPoints,
  type SyntheticSample,
} from './synthetic';

export const DEMO_LINK: LinkState = 'online';
export const DEMO_LAST_SEEN = new Date(DEMO_NOW).toISOString();

/** Strip the synthetic-only fields so demo documents match the real schema. */
export function toReading(s: SyntheticSample): TelemetryReading {
  const { t: _t, ...rest } = s;
  return rest;
}

export function demoLatest(deviceId: string): TelemetryReading | null {
  return toReading(sampleAt(deviceId, DEMO_NOW));
}

export function demoSeries(deviceId: string, from: number, to: number, target = 120): SeriesPoint[] {
  return seriesToPoints(buildSeries(deviceId, from, to, target));
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

export function demoOverview(deviceId: string, from: number, to: number): OverviewPayload {
  const latest = demoLatest(deviceId);
  const pts = demoSeries(deviceId, from, to, 96);
  const battery = deriveBattery(latest as TelemetryReading);
  const score = latest?.ai.anomalyScore ?? 0;
  return {
    latest,
    battery,
    stats: {
      solar: statsFromPoints(pts, 'solar'),
      fuelCell: statsFromPoints(pts, 'fuelCell'),
      vehicle: statsFromPoints(pts, 'vehicle'),
    },
    energy: energyTotals(pts),
    thermal: {
      min: latest?.temperature.min ?? null,
      max: latest?.temperature.max ?? null,
      avg: latest?.temperature.avg ?? null,
      status: thermalStatus(latest?.temperature.max ?? null),
    },
    ai: {
      soc: latest?.ai.soc ?? null,
      range: latest?.ai.range ?? null,
      anomalyScore: score,
      state: anomalyState(score),
      // The demo dataset is generated on the server, so it is explicitly *not*
      // live firmware inference. Never let it be mistaken for a real model run.
      modelVersion: latest?.ai.modelVersion ?? null,
      modelsActive: latest?.ai.modelsActive ?? null,
      inferenceMs: latest?.ai.inferenceMs ?? null,
      isLiveInference: false,
    },
    counts: {
      telemetry: Math.round((DEMO_NOW - from) / 1000),
      alerts: demoAlerts(deviceId, 240).length,
      trips: demoTrips(deviceId, 14).length,
    },
    series: pts,
  };
}

/* -------------------------------------------------------------------------- */
/* Channel pages                                                               */
/* -------------------------------------------------------------------------- */

export function demoChannel(deviceId: string, from: number, to: number) {
  const latest = demoLatest(deviceId);
  const pts = demoSeries(deviceId, from, to, 110);
  return {
    latest,
    points: pts,
    stats: {
      solar: statsFromPoints(pts, 'solar'),
      fuelCell: statsFromPoints(pts, 'fuelCell'),
      vehicle: statsFromPoints(pts, 'vehicle'),
      battery: batteryStatsFromPoints(pts),
    },
    energy: energyTotals(pts),
    soc: socSummary(pts),
    thermal: thermalSummary(pts),
  };
}

export function demoBuckets(deviceId: string, from: number, to: number, bucketMs: number): EnergyBucket[] {
  const pts = demoSeries(deviceId, from, to, 200);
  return bucketize(pts, bucketMs, from, to);
}

export function demoEnergyTotals(deviceId: string, from: number, to: number) {
  const pts = demoSeries(deviceId, from, to, 200);
  return summariseBuckets(bucketize(pts, Math.max(3_600_000, Math.floor((to - from) / 24)), from, to));
}

/* -------------------------------------------------------------------------- */
/* Thermal                                                                     */
/* -------------------------------------------------------------------------- */

export function demoThermal(deviceId: string, from: number, to: number): ThermalReport {
  const latest = demoLatest(deviceId);
  const pts = demoSeries(deviceId, from, to, 110);
  const temp = latest?.temperature ?? { t1: null, t2: null, t3: null, t4: null, min: null, max: null, avg: null };
  const summary = thermalSummary(pts);
  const max = Number.isFinite(summary.max) ? summary.max : (temp.max ?? null);
  const min = Number.isFinite(summary.min) ? summary.min : (temp.min ?? null);
  const avg = Number.isFinite(summary.avg) ? summary.avg : (temp.avg ?? null);
  return {
    sensors: [
      { key: 't1', label: 'T1', zone: 'Photovoltaic roof array', value: temp.t1 },
      { key: 't2', label: 'T2', zone: 'Fuel-cell stack & humidifier', value: temp.t2 },
      { key: 't3', label: 'T3', zone: 'Traction inverter & motor', value: temp.t3 },
      { key: 't4', label: 'T4', zone: 'Battery enclosure & BMS', value: temp.t4 },
    ],
    min,
    max,
    avg,
    delta: max != null && min != null ? max - min : null,
    status: thermalStatus(max),
    series: pts.map((p) => ({ t: p.t, t1: p.t1, t2: p.t2, t3: p.t3, t4: p.t4 })),
    map: buildThermalMap(temp),
    limits: thermalLimits(max),
  };
}

/* -------------------------------------------------------------------------- */
/* AI intelligence                                                             */
/* -------------------------------------------------------------------------- */

export function demoAiModels(deviceId: string, from: number, to: number): AiModelReport[] {
  const pts = demoSeries(deviceId, from, to, 90);
  const latest = demoLatest(deviceId);
  if (!pts.length || !latest) return [];
  const battery = deriveBattery(latest);
  const score = latest.ai.anomalyScore;
  const socValues = series(pts, 'soc');
  const rangeValues = series(pts, 'range');
  const scores = series(pts, 'anomalyScore');
  const state = anomalyState(score);
  const last = new Date(DEMO_NOW).toISOString();
  const pct = (v: number) => `${v.toFixed(1)} %`;
  const first = (v: number[]) => v[0] ?? Number.NaN;
  const lastOf = (v: number[]) => v[v.length - 1] ?? Number.NaN;
  const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : Number.NaN);
  const rangeNow = latest.ai.range ?? Number.NaN;

  return [
    {
      key: 'soc',
      index: AI_MODELS[0].index,
      name: AI_MODELS[0].name,
      description: AI_MODELS[0].description,
      state: first(socValues) - lastOf(socValues) < -30 ? 'warning' : 'normal',
      confidence: 0.972,
      latencyMs: 4.2,
      samples: pts.length * 60,
      lastInference: last,
      metrics: [
        { label: 'Measured SOC', value: pct(battery.soc), hint: 'Coulomb-count + OCV fusion' },
        { label: 'Predicted SOC', value: pct(battery.soc + battery.netPowerW / 900), hint: '+180 s horizon' },
        { label: 'Drift', value: pct(Math.abs(first(socValues) - lastOf(socValues))), hint: 'Across selected window' },
        { label: 'Window mean', value: pct(avg(socValues)), hint: 'Model input baseline' },
      ],
      series: pts.map((p, i) => ({
        t: p.t,
        value: p.soc,
        baseline: p.soc == null ? null : p.soc - ((p.batteryPower ?? 0) / 3600) * 0.05 + Math.sin(i / 4) * 0.4,
      })),
    },
    {
      key: 'range',
      index: AI_MODELS[1].index,
      name: AI_MODELS[1].name,
      description: AI_MODELS[1].description,
      state: rangeNow < 60 ? 'warning' : 'normal',
      confidence: 0.941,
      latencyMs: 5.8,
      samples: pts.length * 60,
      lastInference: last,
      metrics: [
        { label: 'Estimated range', value: `${rangeNow.toFixed(1)} km`, hint: 'Edge range model' },
        { label: 'Efficiency', value: `${(rangeNow / Math.max(1, battery.soc)).toFixed(2)} km/%`, hint: 'Rolling 20-frame mean' },
        { label: 'Trend', value: `${(lastOf(rangeValues) - first(rangeValues)).toFixed(1)} km`, hint: 'Across selected window' },
        { label: 'Confidence band', value: '±3.4 km', hint: 'Widens under high load' },
      ],
      series: pts.map((p) => ({ t: p.t, value: p.range, baseline: p.soc == null ? null : p.soc * 17.4 })),
    },
    {
      key: 'anomaly',
      index: AI_MODELS[2].index,
      name: AI_MODELS[2].name,
      description: AI_MODELS[2].description,
      state,
      confidence: 0.918,
      latencyMs: 6.9,
      samples: pts.length * 60,
      lastInference: last,
      metrics: [
        { label: 'Anomaly score', value: (score ?? 0).toFixed(3), hint: 'Threshold 0.350' },
        { label: 'System health', value: state === 'normal' ? 'NOMINAL' : state.toUpperCase(), hint: 'Auto-encoder reconstruction' },
        { label: 'Peak score', value: (scores.length ? Math.max(...scores) : 0).toFixed(3), hint: 'Window maximum' },
        { label: 'Interventions', value: String(scores.filter((s) => s >= THRESHOLDS.anomaly.warning).length), hint: 'Frames above threshold' },
      ],
      series: pts.map((p) => ({ t: p.t, value: p.anomalyScore, baseline: THRESHOLDS.anomaly.warning })),
    },
  ];
}

export function demoAiTimeline(deviceId: string, count = 24): AiTimelineEvent[] {
  const out: AiTimelineEvent[] = [];
  const base = DEMO_NOW - count * 30_000;
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = base + i * 30_000;
    const s = sampleAt(deviceId, t);
    const mode: AiTimelineEvent['model'] = i % 3 === 0 ? 'soc' : i % 3 === 1 ? 'range' : 'anomaly';
    const st = anomalyState(s.ai.anomalyScore);
    if (mode === 'soc') {
      out.push({
        id: `demo-ai-${t}-soc`,
        timestamp: new Date(t).toISOString(),
        model: 'soc',
        label: 'SOC inference completed',
        detail: `SOC ${s.battery.soc.toFixed(1)} % · pack ${s.vehicle.voltage.toFixed(1)} V · ${s.battery.mode}`,
        status: 'ok',
      });
    } else if (mode === 'range') {
      out.push({
        id: `demo-ai-${t}-range`,
        timestamp: new Date(t).toISOString(),
        model: 'range',
        label: 'Range prediction updated',
        detail: `${s.ai.range.toFixed(1)} km remaining at ${(s.ai.range / Math.max(1, s.battery.soc)).toFixed(2)} km/%`,
        status: s.ai.range < 45 ? 'warning' : 'ok',
      });
    } else {
      out.push({
        id: `demo-ai-${t}-anom`,
        timestamp: new Date(t).toISOString(),
        model: 'anomaly',
        label: st === 'normal' ? 'No anomaly detected' : 'Anomaly signature raised',
        detail: `Score ${s.ai.anomalyScore.toFixed(3)} · peak probe ${s.temperature.max.toFixed(1)} °C`,
        status: st === 'anomaly' ? 'critical' : st === 'warning' ? 'warning' : 'ok',
      });
    }
  }
  return out.reverse();
}

export function demoSystemEvents(deviceId: string, count = 18) {
  const types: { type: string; message: string; detail: string; severity: string }[] = [
    { type: 'database-write', message: 'Telemetry batch committed to MongoDB Atlas', detail: 'collection=telemetry · acknowledged=true', severity: 'info' },
    { type: 'ai', message: 'Edge inference cycle finished inside budget', detail: 'models=soc,range,anomaly · 6.9 ms', severity: 'info' },
    { type: 'wifi', message: 'Wi-Fi association stable', detail: 'RSSI -58 dBm · channel 6 · 802.11n', severity: 'info' },
    { type: 'sensor', message: 'PZEM #1 poll responded', detail: 'addr 0x01 · 4 registers · CRC ok', severity: 'info' },
    { type: 'sensor', message: 'PZEM #2 poll responded', detail: 'addr 0x02 · 4 registers · CRC ok', severity: 'info' },
    { type: 'sensor', message: 'PZEM #3 poll responded', detail: 'addr 0x03 · 4 registers · CRC ok', severity: 'info' },
    { type: 'sensor', message: 'DS18B20 bus reconciled', detail: '4 of 4 probes with valid CRC', severity: 'info' },
    { type: 'mqtt', message: 'Keep-alive published', detail: 'topic evision/EV-DEMO-001/heartbeat', severity: 'info' },
    { type: 'maintenance', message: 'SD card log rotated', detail: '12 telemetry segments retained on card', severity: 'info' },
  ];
  const out: {
    id: string;
    timestamp: string;
    type: string;
    severity: string;
    message: string;
    detail: string;
  }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = DEMO_NOW - i * 47_000;
    const e = types[(count - 1 - i) % types.length];
    out.push({
      id: `demo-evt-${t}`,
      timestamp: new Date(t).toISOString(),
      type: e.type,
      severity: e.severity,
      message: e.message,
      detail: e.detail,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Alerts                                                                      */
/* -------------------------------------------------------------------------- */

export function demoAlerts(deviceId: string, hours = 48, limit = 60): AlertRecord[] {
  const stepMs = 120_000;
  const count = Math.min(1400, Math.round((hours * 3_600_000) / stepMs));
  const out: AlertRecord[] = [];
  const lastEmit = new Map<string, number>();

  for (let i = count; i >= 0; i -= 1) {
    const t = DEMO_NOW - i * stepMs;
    const s = sampleAt(deviceId, t);
    const checks: { category: string; value: number; unit: string }[] = [
      { category: 'high-temperature', value: s.temperature.max, unit: '°C' },
      { category: 'low-soc', value: s.battery.soc, unit: '%' },
      { category: 'high-current', value: Math.abs(s.vehicle.current), unit: 'A' },
      { category: 'high-power', value: Math.abs(s.vehicle.power), unit: 'W' },
      { category: 'abnormal-voltage', value: s.vehicle.voltage, unit: 'V' },
      { category: 'ai-anomaly', value: s.ai.anomalyScore, unit: '' },
    ];
    for (const c of checks) {
      const rule = ALERT_RULES.find((r) => r.category === c.category);
      if (!rule) continue;
      const breach =
        c.category === 'low-soc' ? c.value <= rule.threshold :
        c.category === 'abnormal-voltage' ? c.value <= rule.threshold || c.value >= THRESHOLDS.batteryVoltageHigh :
        c.category === 'ai-anomaly' ? c.value >= rule.threshold :
        c.value >= rule.threshold;
      if (!breach) continue;
      const key = `${c.category}`;
      const prev = lastEmit.get(key) ?? -Infinity;
      if (t - prev < 45 * 60_000) continue;
      lastEmit.set(key, t);
      out.push({
        id: `ALT-DEMO-${t}`,
        deviceId,
        timestamp: new Date(t).toISOString(),
        category: rule.category,
        severity: rule.severity,
        status: 'active',
        source: rule.source,
        value: Math.round(c.value * 1000) / 1000,
        unit: c.unit,
        threshold: rule.threshold,
        message: rule.message(c.value),
      });
    }
  }
  return out.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Trips                                                                       */
/* -------------------------------------------------------------------------- */

const TRIP_WINDOWS = [
  { startH: 7.4, endH: 9.4, name: 'Morning delivery loop' },
  { startH: 11.4, endH: 12.5, name: 'Midday service run' },
  { startH: 14.4, endH: 15.4, name: 'Afternoon shuttle' },
  { startH: 17.8, endH: 20.0, name: 'Evening commute cluster' },
];

export function demoTrips(deviceId: string, days = 14): TripRecord[] {
  const out: TripRecord[] = [];
  for (let d = 0; d < days; d += 1) {
    const dayStart = DEMO_NOW - d * 86_400_000;
    const base = new Date(dayStart);
    base.setUTCHours(0, 0, 0, 0);
    TRIP_WINDOWS.forEach((w, idx) => {
      const startT = base.getTime() + w.startH * 3_600_000;
      if (startT > DEMO_NOW - 600_000) return;
      const durMin = (w.endH - w.startH) * 60 * 4.6;
      const endT = Math.min(startT + durMin * 60_000, DEMO_NOW);
      const pts = demoSeries(deviceId, startT, endT, 40);
      if (pts.length < 4) return;
      // Only frames with a real traction reading can produce a trip; a gap in the
      // middle of a window must not be smoothed over with a zero.
      const vehW = series(pts, 'vehiclePower');
      if (vehW.length < 4) return;
      const temps = series(pts, 'tempAvg');
      const peakC = series(pts, 'tempMax');
      const hours = (endT - startT) / 3_600_000;
      const energyKwh = (vehW.reduce((a, b) => a + b, 0) / vehW.length) * hours;
      const avgPower = vehW.reduce((a, b) => a + b, 0) / vehW.length;
      const distanceKm = Math.max(1.2, (energyKwh / 0.152) * (0.9 + ((d + idx) % 5) / 22));
      const socSeries = series(pts, 'soc');
      const startSoc = socSeries[0] ?? 0;
      const endSoc = socSeries[socSeries.length - 1] ?? startSoc;
      const id = `TRIP-${base.toISOString().slice(0, 10).replace(/-/g, '')}-${String(idx + 1).padStart(2, '0')}`;
      out.push({
        id,
        deviceId,
        startTime: new Date(startT).toISOString(),
        endTime: new Date(endT).toISOString(),
        distanceKm: Math.round(distanceKm * 10) / 10,
        startSoc,
        endSoc,
        energyKwh: Math.round(energyKwh * 100) / 100,
        avgPowerW: Math.round(avgPower),
        peakPowerW: Math.round(Math.max(...vehW)),
        avgTempC: temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : 0,
        maxTempC: peakC.length ? Math.round(Math.max(...peakC) * 10) / 10 : 0,
        solarKwh: Math.round(pts[pts.length - 1].energy.solarKwh - pts[0].energy.solarKwh),
        fuelCellKwh: Math.round(pts[pts.length - 1].energy.fuelCellKwh - pts[0].energy.fuelCellKwh),
        regenerativeKwh: Math.round(series(pts, 'batteryPower').filter((p) => p > 0).length * 0.02 * 100) / 100,
        efficiencyKwhPerKm: Math.round((energyKwh / distanceKm) * 1000) / 1000,
        aiEvents: pts
          .filter((_, i) => i % 8 === 3)
          .map((p, i) => ({
            id: `${id}-ai-${i}`,
            timestamp: new Date(p.t).toISOString(),
            model: (i % 3 === 0 ? 'soc' : i % 3 === 1 ? 'range' : 'anomaly') as 'soc' | 'range' | 'anomaly',
            label:
              i % 3 === 0 ? 'SOC inference completed' : i % 3 === 1 ? 'Range prediction updated' : 'No anomaly detected',
            detail:
              i % 3 === 0
                ? `SOC ${fmt(p.soc, 1)} % · ${(p.vehiclePower ?? 0) > 0 ? 'discharging' : 'regenerating'}`
                : i % 3 === 1
                  ? `${fmt(p.range, 1)} km projected at current load`
                  : `Score ${fmt(p.anomalyScore, 3)} within tolerance`,
            status: ((p.anomalyScore ?? 0) > THRESHOLDS.anomaly.warning ? 'warning' : 'ok') as 'ok' | 'warning',
          })),
        points: pts,
      });
    });
  }
  return out.sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
}

/* -------------------------------------------------------------------------- */
/* Device                                                                      */
/* -------------------------------------------------------------------------- */

export function demoDevice(deviceId: string): DeviceInfo {
  const s = sampleAt(deviceId, DEMO_NOW);
  const channels: DeviceInfo['channels'] = [
    { id: 'pzem-1', label: 'SOLAR PZEM', address: '0x01', role: 'SOLAR', state: 'connected', lastReading: DEMO_LAST_SEEN },
    { id: 'pzem-2', label: 'FUEL CELL PZEM', address: '0x02', role: 'FUEL_CELL', state: 'connected', lastReading: DEMO_LAST_SEEN },
    { id: 'pzem-3', label: 'LOAD PZEM', address: '0x03', role: 'LOAD', state: 'connected', lastReading: DEMO_LAST_SEEN },
  ];
  return {
    deviceId,
    name: 'EVISION Reference Platform (Demo)',
    model: 'EVISION Edge Node EN-3',
    mcu: HARDWARE.mcu,
    firmware: s.meta.firmware ?? 'evision-edge-1.4.2',
    location: 'Chennai · Test Bay 02',
    status: 'online',
    lastSeen: DEMO_LAST_SEEN,
    registeredAt: new Date(DEMO_NOW - 42 * 86_400_000).toISOString(),
    channels,
    temperatureSensors: 4,
    storage: 'sd-card',
    aiModels: ['soc-prediction', 'range-prediction', 'anomaly-detection'],
  };
}

export function demoHardwareSnapshot(deviceId: string) {
  const s = sampleAt(deviceId, DEMO_NOW);
  return {
    firmware: s.meta.firmware ?? 'evision-edge-1.4.2',
    ip: s.meta.ip ?? '192.168.1.44',
    rssi: s.meta.rssi ?? -58,
    uptimeS: s.meta.uptimeS ?? 3_628_800,
    freeHeapBytes: s.meta.freeHeap ?? 314_000,
    sdFreeMb: s.meta.sdFreeMb ?? 14_800,
    mqttTopic: s.meta.mqttTopic ?? `evision/${deviceId}/telemetry`,
    battery: s.battery,
    node: {
      wifi: s.wifi ?? true,
      sd: s.status?.sd ?? true,
      cloud: s.status?.cloud ?? true,
      uptimeS: s.meta.uptimeS ?? null,
    },
  };
}

export { DEMO_NOW };
