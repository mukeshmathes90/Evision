/**
 * EVISION AI — MongoDB Atlas seed script.
 *
 * Populates a cluster with a coherent, physically self-consistent dataset so a
 * fresh deployment has meaningful charts, reports and trip history before the
 * first ESP32-S3 frame lands.
 *
 *   npm run seed              # seed the live device (EV-001)
 *   npm run seed -- --device=EV-001 --hours=72
 *   npm run seed:demo         # seed the isolated synthetic demo device (EV-DEMO-001)
 *   npm run seed -- --wipe    # delete the target device's data first
 *
 * Requires MONGODB_URI in the environment (.env.local is loaded automatically).
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../lib/mongodb';
import { EVISION_DEVICE_ID, EVISION_DEMO_DEVICE_ID, MONGODB_URI } from '../lib/env';
import {
  AiPredictionModel,
  AlertModel,
  DeviceModel,
  EnergySessionModel,
  SystemEventModel,
  TelemetryModel,
  TripModel,
  ensureIndexes,
} from '../models';
import { AI_MODELS, HARDWARE, THRESHOLDS } from '../lib/constants';
import { demoAlerts, demoSystemEvents, demoTrips, DEMO_NOW } from '../lib/demo';
import { sampleAt } from '../lib/synthetic';
import { thermalColor } from '../lib/format';
import type { SyntheticSample } from '../lib/synthetic';

const SAMPLE_INTERVAL_MS = 60_000;
const BULK_CHUNK = 500;

/* -------------------------------------------------------------------------- */
/* CLI parsing                                                                 */
/* -------------------------------------------------------------------------- */

interface Options {
  deviceId: string;
  hours: number;
  intervalMs: number;
  wipe: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const isDemo = argv.includes('--demo');
  const flag = (name: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };

  const deviceId = flag('device') ?? (isDemo ? EVISION_DEMO_DEVICE_ID : EVISION_DEVICE_ID);
  const hoursRaw = Number(flag('hours') ?? (isDemo ? 24 : 72));
  const intervalRaw = Number(flag('interval') ?? SAMPLE_INTERVAL_MS);

  return {
    deviceId,
    hours: Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(hoursRaw, 24 * 90) : 72,
    intervalMs: Number.isFinite(intervalRaw) && intervalRaw >= 1000 ? intervalRaw : SAMPLE_INTERVAL_MS,
    wipe: argv.includes('--wipe'),
    dryRun: argv.includes('--dry-run'),
  };
}

/* -------------------------------------------------------------------------- */
/* Document builders                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The synthetic generator is anchored to a fixed clock so the demo dataset is
 * reproducible. Seeding live data rebases it onto real wall-clock time so the
 * node looks genuinely online.
 */
function anchorFor(deviceId: string): number {
  return deviceId === EVISION_DEMO_DEVICE_ID ? DEMO_NOW : Date.now();
}

function telemetryDoc(deviceId: string, s: SyntheticSample, sequence: number) {
  const { t: _t, ...reading } = s;
  return {
    ...reading,
    deviceId,
    timestamp: new Date(reading.timestamp),
    sequence,
    ingestMs: 40 + (sequence % 25),
  };
}

function predictionDocs(deviceId: string, samples: SyntheticSample[]) {
  const out: Record<string, unknown>[] = [];
  samples.forEach((s, i) => {
    const base = { deviceId, timestamp: new Date(s.timestamp), modelVersion: 'edge-v1' };

    out.push({
      ...base,
      model: 'soc',
      prediction: s.ai.soc,
      actual: s.battery.soc,
      baseline: Math.round((s.battery.soc - s.battery.netPowerW / 900) * 100) / 100,
      confidence: 0.972,
      latencyMs: s.ai.inferenceMs ?? 4.2,
      state: s.ai.anomalyScore > THRESHOLDS.anomaly.warning ? 'warning' : 'normal',
      features: [s.battery.soc, s.battery.netPowerW, s.vehicle.power, s.temperature.avg],
      label: 'SOC inference completed',
      detail: `measured ${s.battery.soc.toFixed(1)} %`,
    });

    out.push({
      ...base,
      model: 'range',
      prediction: s.ai.range,
      actual: s.ai.range,
      baseline: Math.round(s.battery.soc * 17.4 * 100) / 100,
      confidence: 0.941,
      latencyMs: (s.ai.inferenceMs ?? 5.8) + 1.6,
      state: s.ai.anomalyScore > THRESHOLDS.anomaly.warning ? 'warning' : 'normal',
      features: [s.ai.range, s.battery.soc, s.battery.netPowerW, s.vehicle.power],
      label: 'Range prediction updated',
      detail: `${s.ai.range.toFixed(1)} km at ${s.battery.soc.toFixed(1)} %`,
    });

    if (i % 5 === 0 || s.ai.anomalyScore > THRESHOLDS.anomaly.warning) {
      out.push({
        ...base,
        model: 'anomaly',
        prediction: s.ai.anomalyScore,
        actual: s.ai.anomalyScore,
        baseline: 0.12,
        confidence: 0.92,
        latencyMs: (s.ai.inferenceMs ?? 6.9) + 2.1,
        state: s.ai.anomalyScore > THRESHOLDS.anomaly.critical ? 'anomaly' : s.ai.anomalyScore > THRESHOLDS.anomaly.warning ? 'warning' : 'normal',
        features: [s.ai.anomalyScore, s.temperature.max, s.vehicle.current, s.vehicle.voltage],
        label: s.ai.anomalyScore > THRESHOLDS.anomaly.warning ? 'Anomaly score above warning band' : 'No anomaly detected',
        detail: `score ${s.ai.anomalyScore.toFixed(3)} · hottest probe ${thermalColor(s.temperature.max)} band`,
      });
    }
  });
  return out;
}

function alertDocs(deviceId: string, shiftMs: number) {
  return demoAlerts(deviceId, 72, 120).map((a) => ({
    deviceId,
    timestamp: new Date(a.timestamp + shiftMs),
    category: a.category,
    severity: a.severity,
    status: a.status,
    source: a.source,
    value: a.value,
    unit: a.unit,
    threshold: a.threshold,
    message: a.message,
    acknowledgedAt: a.acknowledgedAt ? new Date(a.acknowledgedAt + shiftMs) : null,
    resolvedAt: a.resolvedAt ? new Date(a.resolvedAt + shiftMs) : null,
  }));
}

function tripDocs(deviceId: string, shiftMs: number) {
  return demoTrips(deviceId, 21).map((t) => ({
    deviceId,
    tripId: t.id,
    startTime: new Date(t.startTime + shiftMs),
    endTime: t.endTime ? new Date(t.endTime + shiftMs) : null,
    distanceKm: t.distanceKm,
    startSoc: t.startSoc,
    endSoc: t.endSoc,
    energyKwh: t.energyKwh,
    avgPowerW: t.avgPowerW,
    peakPowerW: t.peakPowerW,
    avgTempC: t.avgTempC,
    maxTempC: t.maxTempC,
    solarKwh: t.solarKwh,
    fuelCellKwh: t.fuelCellKwh,
    regenerativeKwh: t.regenerativeKwh,
    efficiencyKwhPerKm: t.efficiencyKwhPerKm,
    aiEvents: t.aiEvents.map((e) => ({
      timestamp: new Date(e.timestamp + shiftMs),
      model: e.model,
      label: e.label,
      detail: e.detail,
      status: e.status,
    })),
  }));
}

function energySessionDocs(deviceId: string, samples: SyntheticSample[]) {
  const sessions = new Map<string, {
    startTime: Date;
    solarKwh: number;
    fuelCellKwh: number;
    vehicleKwh: number;
    batteryKwh: number;
    peakPowerW: number;
    socStart: number;
    socEnd: number;
    tempMax: number;
  }>();

  for (const s of samples) {
    const day = s.timestamp.slice(0, 10);
    const entry = sessions.get(day) ?? {
      startTime: new Date(s.timestamp),
      solarKwh: 0,
      fuelCellKwh: 0,
      vehicleKwh: 0,
      batteryKwh: 0,
      peakPowerW: 0,
      socStart: s.battery.soc,
      socEnd: s.battery.soc,
      tempMax: s.temperature.max,
    };
    entry.vehicleKwh += Math.max(0, s.vehicle.power) / 3_600_000;
    entry.batteryKwh += Math.abs(s.battery.netPowerW) / 3_600_000;
    entry.peakPowerW = Math.max(entry.peakPowerW, Math.abs(s.vehicle.power));
    entry.socEnd = s.battery.soc;
    entry.tempMax = Math.max(entry.tempMax, s.temperature.max);
    sessions.set(day, entry);
  }

  // Energy counters are cumulative; the per-sample deltas above are converted
  // into generation totals by differencing the first and last reading of the day.
  const ordered = [...samples].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return [...sessions.entries()].map(([day, e]) => {
    const daySamples = ordered.filter((s) => s.timestamp.startsWith(day));
    const first = daySamples[0];
    const last = daySamples[daySamples.length - 1];
    const solarKwh = last ? last.solar.energy - first.solar.energy : 0;
    const fuelCellKwh = last ? last.fuelCell.energy - first.fuelCell.energy : 0;
    const vehicleKwh = last ? last.vehicle.energy - first.vehicle.energy : e.vehicleKwh;
    const netKwh = solarKwh + fuelCellKwh - vehicleKwh;
    return {
      deviceId,
      sessionId: `ES-${day.replace(/-/g, '')}`,
      startTime: e.startTime,
      endTime: last ? new Date(last.timestamp) : null,
      bucket: 'day',
      solarKwh: round3(solarKwh),
      fuelCellKwh: round3(fuelCellKwh),
      vehicleKwh: round3(vehicleKwh),
      batteryKwh: round3(e.batteryKwh),
      netKwh: round3(netKwh),
      regenerativeKwh: round3(Math.max(0, e.batteryKwh * 0.22)),
      peakPowerW: Math.round(e.peakPowerW),
      avgPowerW: Math.round(vehicleKwh > 0 ? (vehicleKwh * 3_600_000) / ((last ? Date.parse(last.timestamp) : 0) - e.startTime.getTime()) / 1000 : 0),
      startSoc: round1(e.socStart),
      endSoc: round1(e.socEnd),
      avgTempC: daySamples.length ? round1(daySamples.reduce((a, s) => a + s.temperature.avg, 0) / daySamples.length) : null,
      maxTempC: round1(e.tempMax),
    };
  });
}

function systemEventDocs(deviceId: string, shiftMs: number) {
  return demoSystemEvents(deviceId, 24).map((e) => ({
    deviceId,
    timestamp: new Date(e.timestamp + shiftMs),
    type: e.type,
    severity: e.severity,
    message: e.message,
    detail: e.detail,
    firmware: 'evision-edge-1.4.2',
  }));
}

function deviceDoc(deviceId: string, lastSeen: Date) {
  const demo = deviceId === EVISION_DEMO_DEVICE_ID;
  return {
    deviceId,
    name: demo ? 'EVISION Demo Node' : 'EVISION Edge Node 01',
    model: 'EVISION Edge Node',
    mcu: HARDWARE.mcu,
    firmware: 'evision-edge-1.4.2',
    hardwareRevision: 'rev-A',
    location: demo ? 'Synthetic dataset' : 'Viyal Tech Lab, Bay 2',
    status: 'online',
    lastSeen,
    registeredAt: new Date(Date.now() - 90 * 86_400_000),
    channels: HARDWARE.protocolAddressMap.map((c) => ({
      id: c.id,
      label: c.role === 'SOLAR' ? 'Solar array' : c.role === 'FUEL_CELL' ? 'Fuel-cell stack' : 'Traction / load',
      address: c.address,
      role: c.role,
      state: 'connected',
      lastReading: lastSeen,
      lastAddressPoll: lastSeen,
    })),
    temperatureSensors: HARDWARE.temperatureSensors,
    temperatureModel: 'DS18B20',
    storage: 'sd-card',
    aiModels: AI_MODELS.map((m) => m.key),
    ip: null,
    rssi: null,
    samplingIntervalMs: SAMPLE_INTERVAL_MS,
    tags: demo ? ['synthetic', 'isolated'] : ['seeded'],
    notes: demo
      ? 'Synthetic dataset produced by scripts/seed.ts. Never merged with live telemetry.'
      : 'Seeded baseline dataset produced by scripts/seed.ts.',
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  console.log('EVISION AI — seed');
  console.log(`  device     ${opts.deviceId}`);
  console.log(`  window     ${opts.hours} h @ ${opts.intervalMs} ms`);
  console.log(`  wipe       ${opts.wipe}`);
  console.log(`  dry-run    ${opts.dryRun}`);
  if (!opts.dryRun && !MONGODB_URI) {
    console.error('\nMONGODB_URI is not set. Add it to .env.local before seeding (or pass --dry-run to preview without credentials).');
    process.exitCode = 1;
    return;
  }

  const anchor = anchorFor(opts.deviceId);
  const to = anchor;
  const from = anchor - opts.hours * 3_600_000;

  const samples: SyntheticSample[] = [];
  for (let t = from; t <= to; t += opts.intervalMs) {
    samples.push(sampleAt(opts.deviceId, t));
  }

  const lastSeen = new Date(to);
  const telemetry = samples.map((s, i) => telemetryDoc(opts.deviceId, s, i + 1));
  const predictions = predictionDocs(opts.deviceId, samples);
  const shiftMs = anchor - DEMO_NOW;
  const alerts = alertDocs(opts.deviceId, shiftMs);
  const trips = tripDocs(opts.deviceId, shiftMs);
  const sessions = energySessionDocs(opts.deviceId, samples);
  const events = systemEventDocs(opts.deviceId, shiftMs);

  console.log('\nPlanned writes');
  console.log(`  telemetry        ${telemetry.length}`);
  console.log(`  ai_predictions   ${predictions.length}`);
  console.log(`  alerts           ${alerts.length}`);
  console.log(`  trips            ${trips.length}`);
  console.log(`  energy_sessions  ${sessions.length}`);
  console.log(`  system_events    ${events.length}`);
  console.log(`  devices          1`);

  if (opts.dryRun) {
    console.log('\n--dry-run set: nothing was written.');
    return;
  }

  await connectToDatabase();
  console.log('\nConnected. Ensuring indexes…');
  const indexes = await ensureIndexes();
  console.log(`  ${indexes.length ? indexes.join(', ') : 'indexes already current'}`);

  if (opts.wipe) {
    console.log('Wiping existing data for this device…');
    await Promise.all([
      TelemetryModel.deleteMany({ deviceId: opts.deviceId }),
      AiPredictionModel.deleteMany({ deviceId: opts.deviceId }),
      AlertModel.deleteMany({ deviceId: opts.deviceId }),
      TripModel.deleteMany({ deviceId: opts.deviceId }),
      EnergySessionModel.deleteMany({ deviceId: opts.deviceId }),
      SystemEventModel.deleteMany({ deviceId: opts.deviceId }),
      DeviceModel.deleteMany({ deviceId: opts.deviceId }),
    ]);
  }

  await DeviceModel.updateOne(
    { deviceId: opts.deviceId },
    { $set: deviceDoc(opts.deviceId, lastSeen) },
    { upsert: true },
  );

  await insertMany(TelemetryModel, telemetry, opts.deviceId, 'telemetry');
  await insertMany(AiPredictionModel, predictions, opts.deviceId, 'ai_predictions');
  await insertMany(AlertModel, alerts, opts.deviceId, 'alerts');
  await insertMany(TripModel, trips, opts.deviceId, 'trips');
  await insertMany(EnergySessionModel, sessions, opts.deviceId, 'energy_sessions');
  await insertMany(SystemEventModel, events, opts.deviceId, 'system_events');

  console.log(`\nSeed complete for ${opts.deviceId}.`);
  await disconnectFromDatabase();
}

async function insertMany(
  m: mongoose.Model<Record<string, unknown>>,
  rows: Record<string, unknown>[],
  deviceId: string,
  label: string,
): Promise<void> {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BULK_CHUNK) {
    const chunk = rows.slice(i, i + BULK_CHUNK);
    await m.insertMany(chunk, { ordered: false });
  }
  console.log(`  inserted ${rows.length} → ${label} (${deviceId})`);
}

main()
  .catch(async (err: unknown) => {
    console.error('\nSeed failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
    try {
      await mongoose.disconnect();
    } catch {
      /* already disconnected */
    }
  });