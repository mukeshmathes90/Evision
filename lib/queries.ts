import 'server-only';
import type { PipelineStage } from 'mongoose';
import { connectToDatabase, isDatabaseConfigured } from './mongodb';
import {
  AlertModel,
  AiPredictionModel,
  DeviceModel,
  EnergySessionModel,
  SystemEventModel,
  TelemetryModel,
  TripModel,
} from '@/models';
import type {
  AiTimelineEvent,
  AlertRecord,
  ChannelStats,
  DeviceInfo,
  EnergyBucket,
  EnergyTotals,
  SeriesPoint,
  TelemetryReading,
  TripRecord,
} from '@/types';
import { ALERT_RULES, THRESHOLDS } from './constants';
import { anomalyState, normaliseReading, thermalStatus } from './format';

/**
 * Server-side data access.
 *
 * Design rules enforced here:
 *  1. Never `find()` an unbounded collection — every read is windowed by
 *     `timestamp` and/or paginated, and served through the indexed
 *     `{ deviceId, timestamp }` compound index.
 *  2. All heavy lifting (stats, energy rollups) happens inside MongoDB
 *     aggregation pipelines; only the reduced result crosses the wire.
 *  3. MongoDB credentials stay in this process.
 */

const PROJ = {
  deviceId: 1,
  timestamp: 1,
  'solar.voltage': 1,
  'solar.current': 1,
  'solar.power': 1,
  'solar.energy': 1,
  'fuelCell.voltage': 1,
  'fuelCell.current': 1,
  'fuelCell.power': 1,
  'fuelCell.energy': 1,
  'vehicle.voltage': 1,
  'vehicle.current': 1,
  'vehicle.power': 1,
  'vehicle.energy': 1,
  'temperature.t1': 1,
  'temperature.t2': 1,
  'temperature.t3': 1,
  'temperature.t4': 1,
  'temperature.min': 1,
  'temperature.max': 1,
  'temperature.avg': 1,
  'ai.soc': 1,
  'ai.range': 1,
  'ai.anomalyScore': 1,
  'ai.inferenceMs': 1,
  'ai.horizonS': 1,
  'battery.soc': 1,
  'battery.mode': 1,
  'battery.netPowerW': 1,
  'battery.condition': 1,
  'battery.healthPct': 1,
  'battery.cycles': 1,
  'battery.cellVoltage': 1,
  'battery.cellCount': 1,
  'meta.firmware': 1,
  'meta.rssi': 1,
  'meta.uptimeS': 1,
  'meta.freeHeap': 1,
  'meta.sdFreeMb': 1,
  'meta.ip': 1,
} as const;

/** Projection for the `devices` collection (fleet selector + hardware status). */
const DEVICE_PROJ = {
  deviceId: 1,
  name: 1,
  model: 1,
  mcu: 1,
  firmware: 1,
  location: 1,
  status: 1,
  lastSeen: 1,
  registeredAt: 1,
  channels: 1,
  temperatureSensors: 1,
  temperatureModel: 1,
  storage: 1,
  aiModels: 1,
  ip: 1,
  rssi: 1,
  sdFreeMb: 1,
  freeHeapBytes: 1,
  uptimeS: 1,
  wifi: 1,
  cloudState: 1,
  sdState: 1,
} as const;

/* -------------------------------------------------------------------------- */
/* Device fleet                                                                */
/* -------------------------------------------------------------------------- */

export async function listDevices(): Promise<DeviceInfo[]> {
  await connectToDatabase();
  const docs = await DeviceModel.find({}, DEVICE_PROJ).sort({ lastSeen: -1 }).limit(50).lean();
  return docs.map((d) => mapDevice(d as Record<string, unknown>));
}

export async function getDevice(deviceId: string): Promise<DeviceInfo | null> {
  await connectToDatabase();
  const doc = await DeviceModel.findOne({ deviceId }).lean();
  return doc ? mapDevice(doc as Record<string, unknown>) : null;
}

function mapDevice(d: Record<string, unknown>): DeviceInfo {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    deviceId: String(d.deviceId),
    name: String(d.name ?? d.deviceId),
    model: String(d.model ?? 'EVISION Edge Node'),
    mcu: String(d.mcu ?? 'ESP32-S3 N16R8'),
    firmware: String(d.firmware ?? 'unknown'),
    location: String(d.location ?? 'Unassigned'),
    status: (d.status as DeviceInfo['status']) ?? 'offline',
    lastSeen: iso(d.lastSeen),
    registeredAt: iso(d.registeredAt) ?? new Date(0).toISOString(),
    channels:
      Array.isArray(d.channels) && d.channels.length
        ? (d.channels as Record<string, unknown>[]).map((c) => ({
            id: String(c.id),
            label: String(c.label),
            address: String(c.address),
            role: c.role as DeviceInfo['channels'][number]['role'],
            state: (c.state as DeviceInfo['channels'][number]['state']) ?? 'no-data',
            lastReading: iso(c.lastReading),
          }))
        : defaultChannels(),
    temperatureSensors: Number(d.temperatureSensors ?? 4),
    storage: (d.storage as DeviceInfo['storage']) ?? 'sd-card',
    aiModels: Array.isArray(d.aiModels) ? (d.aiModels as string[]) : ['soc-prediction', 'range-prediction', 'anomaly-detection'],
  };
}

function defaultChannels(): DeviceInfo['channels'] {
  return [
    { id: 'pzem-1', label: 'SOLAR PZEM', address: '0x01', role: 'SOLAR', state: 'no-data', lastReading: null },
    { id: 'pzem-2', label: 'FUEL CELL PZEM', address: '0x02', role: 'FUEL_CELL', state: 'no-data', lastReading: null },
    { id: 'pzem-3', label: 'LOAD PZEM', address: '0x03', role: 'LOAD', state: 'no-data', lastReading: null },
  ];
}

/* -------------------------------------------------------------------------- */
/* Telemetry core reads                                                        */
/* -------------------------------------------------------------------------- */

export async function getLatestReading(deviceId: string): Promise<TelemetryReading | null> {
  await connectToDatabase();
  const doc = await TelemetryModel.findOne({ deviceId }, PROJ).sort({ timestamp: -1 }).lean();
  return doc ? normaliseReading(doc as Record<string, unknown>) : null;
}

export async function getRecentReadings(deviceId: string, limit = 60): Promise<TelemetryReading[]> {
  await connectToDatabase();
  const docs = await TelemetryModel.find({ deviceId }, PROJ).sort({ timestamp: -1 }).limit(Math.min(limit, 500)).lean();
  return docs.reverse().map((d) => normaliseReading(d as Record<string, unknown>));
}

/**
 * Downsample a window into a fixed number of buckets using a single aggregation.
 * The windowed `$match` rides the `{ deviceId, timestamp }` index so the cost
 * scales with the number of documents inside the window, not the collection.
 */
export async function getSeries(
  deviceId: string,
  from: number,
  to: number,
  points = 120,
): Promise<SeriesPoint[]> {
  await connectToDatabase();
  const span = Math.max(1000, to - from);
  const bucketMs = Math.max(1000, Math.floor(span / points));

  const pipeline: PipelineStage[] = [
    { $match: { deviceId, timestamp: { $gte: new Date(from), $lte: new Date(to) } } },
    { $sort: { timestamp: 1 } },
    {
      $project: {
        bucket: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, bucketMs] }] },
        sp: '$solar.power',
        sc: '$solar.current',
        sv: '$solar.voltage',
        fp: '$fuelCell.power',
        fc: '$fuelCell.current',
        fv: '$fuelCell.voltage',
        vp: '$vehicle.power',
        vc: '$vehicle.current',
        vv: '$vehicle.voltage',
        bp: '$battery.netPowerW',
        t1: '$temperature.t1',
        t2: '$temperature.t2',
        t3: '$temperature.t3',
        t4: '$temperature.t4',
        ta: '$temperature.avg',
        tm: '$temperature.max',
        soc: '$ai.soc',
        rng: '$ai.range',
        an: '$ai.anomalyScore',
        se: '$solar.energy',
        fe: '$fuelCell.energy',
        ve: '$vehicle.energy',
      },
    },
    {
      $group: {
        _id: '$bucket',
        sp: { $avg: '$sp' },
        sc: { $avg: '$sc' },
        sv: { $avg: '$sv' },
        fp: { $avg: '$fp' },
        fc: { $avg: '$fc' },
        fv: { $avg: '$fv' },
        vp: { $avg: '$vp' },
        vc: { $avg: '$vc' },
        vv: { $avg: '$vv' },
        bp: { $avg: '$bp' },
        t1: { $avg: '$t1' },
        t2: { $avg: '$t2' },
        t3: { $avg: '$t3' },
        t4: { $avg: '$t4' },
        ta: { $avg: '$ta' },
        tm: { $max: '$tm' },
        soc: { $last: '$soc' },
        socAvg: { $avg: '$soc' },
        rng: { $last: '$rng' },
        an: { $max: '$an' },
        se0: { $first: '$se' },
        se1: { $last: '$se' },
        fe0: { $first: '$fe' },
        fe1: { $last: '$fe' },
        ve0: { $first: '$ve' },
        ve1: { $last: '$ve' },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const rows = (await TelemetryModel.aggregate(pipeline).allowDiskUse(false).exec()) as Record<string, number>[];
  return rows.map((r) => {
    const vv = Number(r.vv) || 0;
    const bp = Number(r.bp) || 0;
    return {
      t: Number(r._id),
      solarPower: Number(r.sp) || 0,
      fuelCellPower: Number(r.fp) || 0,
      vehiclePower: Math.max(0, Number(r.vp) || 0),
      batteryPower: bp,
      solarCurrent: Number(r.sc) || 0,
      fuelCellCurrent: Number(r.fc) || 0,
      vehicleCurrent: Number(r.vc) || 0,
      batteryCurrent: vv ? bp / vv : 0,
      voltage: vv,
      solarVoltage: Number(r.sv) || 0,
      fuelCellVoltage: Number(r.fv) || 0,
      vehicleVoltage: vv,
      soc: Number(r.soc) || 0,
      range: Number(r.rng) || 0,
      anomalyScore: Number(r.an) || 0,
      t1: Number(r.t1) || 0,
      t2: Number(r.t2) || 0,
      t3: Number(r.t3) || 0,
      t4: Number(r.t4) || 0,
      tempAvg: Number(r.ta) || 0,
      tempMax: Number(r.tm) || 0,
      energy: {
        solarKwh: Number(r.se1 ?? 0) - Number(r.se0 ?? 0),
        fuelCellKwh: Number(r.fe1 ?? 0) - Number(r.fe0 ?? 0),
        batteryKwh: Math.abs(bp) / 1000,
        vehicleKwh: Number(r.ve1 ?? 0) - Number(r.ve0 ?? 0),
        netKwh:
          Number(r.se1 ?? 0) -
          Number(r.se0 ?? 0) +
          (Number(r.fe1 ?? 0) - Number(r.fe0 ?? 0)) -
          (Number(r.ve1 ?? 0) - Number(r.ve0 ?? 0)),
        regenerativeKwh: 0,
      },
    };
  });
}

/**
 * Exact min / max / avg / count per channel in one pass. Peaks are read from
 * the raw documents rather than the downsampled series so the dashboard never
 * under-reports a transient spike.
 */
export async function getChannelSummary(
  deviceId: string,
  from: number,
  to: number,
): Promise<Record<'solar' | 'fuelCell' | 'vehicle', ChannelStats>> {
  await connectToDatabase();
  const pipeline: PipelineStage[] = [
    { $match: { deviceId, timestamp: { $gte: new Date(from), $lte: new Date(to) } } },
    {
      $group: {
        _id: null,
        n: { $sum: 1 },
        spMax: { $max: '$solar.power' },
        spSum: { $sum: '$solar.power' },
        spAct: { $sum: { $cond: [{ $gt: [{ $abs: '$solar.power' }, 5] }, 1, 0] } },
        svAvg: { $avg: '$solar.voltage' },
        svMax: { $max: '$solar.voltage' },
        svMin: { $min: { $cond: [{ $gt: ['$solar.voltage', 0.5] }, '$solar.voltage', 9999] } },
        scAvg: { $avg: '$solar.current' },
        scMax: { $max: { $abs: '$solar.current' } },
        fpMax: { $max: '$fuelCell.power' },
        fpSum: { $sum: '$fuelCell.power' },
        fpAct: { $sum: { $cond: [{ $gt: [{ $abs: '$fuelCell.power' }, 5] }, 1, 0] } },
        fvAvg: { $avg: '$fuelCell.voltage' },
        fvMax: { $max: '$fuelCell.voltage' },
        fvMin: { $min: { $cond: [{ $gt: ['$fuelCell.voltage', 0.5] }, '$fuelCell.voltage', 9999] } },
        fcAvg: { $avg: '$fuelCell.current' },
        fcMax: { $max: { $abs: '$fuelCell.current' } },
        vpMax: { $max: '$vehicle.power' },
        vpSum: { $sum: '$vehicle.power' },
        vpAct: { $sum: { $cond: [{ $gt: [{ $abs: '$vehicle.power' }, 20] }, 1, 0] } },
        vvAvg: { $avg: '$vehicle.voltage' },
        vvMax: { $max: '$vehicle.voltage' },
        vvMin: { $min: '$vehicle.voltage' },
        vcAvg: { $avg: '$vehicle.current' },
        vcMax: { $max: { $abs: '$vehicle.current' } },
        bpSum: { $sum: { $abs: '$battery.netPowerW' } },
      },
    },
  ];
  const rows = (await TelemetryModel.aggregate(pipeline).exec()) as Record<string, number>[];
  const r = rows[0];
  const mk = (
    pMax: number,
    pSum: number,
    pAct: number,
    vAvg: number,
    vMax: number,
    vMin: number,
    cAvg: number,
    cMax: number,
  ): ChannelStats => ({
    voltageAvg: n(vAvg),
    voltagePeak: n(vMax),
    voltageMin: n(vMin),
    currentAvg: n(cAvg),
    currentPeak: n(cMax),
    powerAvg: r?.n ? n(pSum / r.n) : Number.NaN,
    powerPeak: n(pMax),
    energyDelta: Number.NaN,
    samples: Number(r?.n ?? 0),
    activeRatio: r?.n ? n((pAct / r.n) * 100) : Number.NaN,
  });
  return {
    solar: mk(r?.spMax, r?.spSum, r?.spAct, r?.svAvg, r?.svMax, r?.svMin, r?.scAvg, r?.scMax),
    fuelCell: mk(r?.fpMax, r?.fpSum, r?.fpAct, r?.fvAvg, r?.fvMax, r?.fvMin, r?.fcAvg, r?.fcMax),
    vehicle: mk(r?.vpMax, r?.vpSum, r?.vpAct, r?.vvAvg, r?.vvMax, r?.vvMin, r?.vcAvg, r?.vcMax),
  };
}

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;
}

/** Energy rollup buckets computed by MongoDB. */
export async function getEnergyBuckets(
  deviceId: string,
  from: number,
  to: number,
  bucketMs: number,
): Promise<EnergyBucket[]> {
  await connectToDatabase();
  const pipeline: PipelineStage[] = [
    { $match: { deviceId, timestamp: { $gte: new Date(from), $lte: new Date(to) } } },
    { $sort: { timestamp: 1 } },
    {
      $project: {
        bucket: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, bucketMs] }] },
        sp: '$solar.power',
        fp: '$fuelCell.power',
        vp: '$vehicle.power',
        bp: '$battery.netPowerW',
        ta: '$temperature.avg',
        soc: '$ai.soc',
        se: '$solar.energy',
        fe: '$fuelCell.energy',
        ve: '$vehicle.energy',
      },
    },
    {
      $group: {
        _id: '$bucket',
        sp: { $avg: '$sp' },
        spMax: { $max: '$sp' },
        fp: { $avg: '$fp' },
        vp: { $avg: '$vp' },
        vpMax: { $max: '$vp' },
        bp: { $sum: { $abs: '$bp' } },
        ta: { $avg: '$ta' },
        soc: { $avg: '$soc' },
        se0: { $first: '$se' },
        se1: { $last: '$se' },
        fe0: { $first: '$fe' },
        fe1: { $last: '$fe' },
        ve0: { $first: '$ve' },
        ve1: { $last: '$ve' },
      },
    },
    { $sort: { _id: 1 } },
  ];
  const rows = (await TelemetryModel.aggregate(pipeline).exec()) as Record<string, number>[];
  const hours = bucketMs / 3_600_000;
  return rows.map((r) => {
    const solarKwh = ((Number(r.sp) || 0) * hours) / 1000;
    const fuelCellKwh = ((Number(r.fp) || 0) * hours) / 1000;
    const vehicleKwh = ((Number(r.vp) || 0) * hours) / 1000;
    const batteryKwh = ((Number(r.bp) || 0) * hours) / 1000;
    return {
      t: Number(r._id),
      label: new Date(Number(r._id)).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: bucketMs >= 86_400_000 ? undefined : '2-digit',
        minute: bucketMs >= 86_400_000 ? undefined : '2-digit',
        timeZone: 'UTC',
      }),
      solarKwh,
      fuelCellKwh,
      vehicleKwh,
      batteryKwh,
      netKwh: solarKwh + fuelCellKwh - vehicleKwh,
      avgPowerW: Number(r.vp) || 0,
      peakPowerW: Number(r.vpMax) || 0,
      socAvg: Number(r.soc) || 0,
      tempAvg: Number(r.ta) || 0,
    };
  });
}

export async function getEnergyTotalsFromSessions(deviceId: string, from: number, to: number): Promise<EnergyTotals | null> {
  await connectToDatabase();
  const rows = (await EnergySessionModel.aggregate([
    { $match: { deviceId, startTime: { $gte: new Date(from), $lte: new Date(to) } } },
    {
      $group: {
        _id: null,
        solarKwh: { $sum: '$solarKwh' },
        fuelCellKwh: { $sum: '$fuelCellKwh' },
        vehicleKwh: { $sum: '$vehicleKwh' },
        batteryKwh: { $sum: '$batteryKwh' },
        netKwh: { $sum: '$netKwh' },
        regen: { $sum: '$regenerativeKwh' },
      },
    },
  ]).exec()) as Record<string, number>[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    solarKwh: n(r.solarKwh) || 0,
    fuelCellKwh: n(r.fuelCellKwh) || 0,
    vehicleKwh: n(r.vehicleKwh) || 0,
    batteryKwh: n(r.batteryKwh) || 0,
    netKwh: n(r.netKwh) || 0,
    regenerativeKwh: n(r.regen) || 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Alerts                                                                      */
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

export async function getAlerts(q: AlertQuery): Promise<AlertRecord[]> {
  await connectToDatabase();
  const filter: Record<string, unknown> = {
    deviceId: q.deviceId,
    timestamp: { $gte: new Date(q.from), $lte: new Date(q.to) },
  };
  if (q.severity?.length) filter.severity = { $in: q.severity };
  if (q.category?.length) filter.category = { $in: q.category };
  if (q.status?.length) filter.status = { $in: q.status };
  if (q.search) filter.message = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const docs = await AlertModel.find(filter)
    .sort({ timestamp: -1 })
    .limit(Math.min(q.limit ?? 120, 400))
    .lean();
  return docs.map((d) => mapAlert(d as Record<string, unknown>));
}

/**
 * Derive alerts on the fly from telemetry for windows that predate the
 * `alerts` collection. This keeps the Alerts page meaningful even before the
 * firmware-side rule engine is enabled.
 */
export async function getDerivedAlerts(deviceId: string, from: number, to: number, limit = 40): Promise<AlertRecord[]> {
  await connectToDatabase();
  const docs = await TelemetryModel.find(
    { deviceId, timestamp: { $gte: new Date(from), $lte: new Date(to) } },
    {
      timestamp: 1,
      'vehicle.current': 1,
      'vehicle.power': 1,
      'vehicle.voltage': 1,
      'ai.soc': 1,
      'ai.anomalyScore': 1,
      'temperature.max': 1,
      _id: 1,
    },
  )
    .sort({ timestamp: 1 })
    .limit(3000)
    .lean();

  const out: AlertRecord[] = [];
  const lastEmit = new Map<string, number>();
  const throttled = new Set<string>();

  for (const d of docs) {
    const row = d as unknown as {
      timestamp: Date;
      vehicle?: { current?: number; power?: number; voltage?: number };
      ai?: { soc?: number; anomalyScore?: number };
      temperature?: { max?: number };
      _id: unknown;
    };
    const t = row.timestamp.getTime();
    const cur = Math.abs(Number(row.vehicle?.current ?? 0));
    const pwr = Math.abs(Number(row.vehicle?.power ?? 0));
    const volt = Number(row.vehicle?.voltage ?? 0);
    const soc = Number(row.ai?.soc ?? 0);
    const score = Number(row.ai?.anomalyScore ?? 0);
    const tmax = Number(row.temperature?.max ?? 0);

    const candidates: { category: string; value: number; unit: string }[] = [
      { category: 'high-temperature', value: tmax, unit: '°C' },
      { category: 'low-soc', value: soc, unit: '%' },
      { category: 'high-current', value: cur, unit: 'A' },
      { category: 'high-power', value: pwr, unit: 'W' },
      { category: 'abnormal-voltage', value: volt, unit: 'V' },
      { category: 'ai-anomaly', value: score, unit: '' },
    ];

    for (const c of candidates) {
      const rule = ALERT_RULES.find((r) => r.category === c.category);
      if (!rule) continue;
      const breach =
        c.category === 'low-soc'
          ? c.value <= rule.threshold
          : c.category === 'abnormal-voltage'
            ? c.value <= rule.threshold || c.value >= THRESHOLDS.batteryVoltageHigh
            : c.category === 'ai-anomaly'
              ? c.value >= rule.threshold
              : c.value >= rule.threshold;
      if (!breach) continue;
      const prev = lastEmit.get(c.category) ?? -Infinity;
      if (t - prev < 45 * 60_000) continue;
      lastEmit.set(c.category, t);
      throttled.add(c.category);
      out.push({
        id: `DRV-${String(row._id)}`,
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

function mapAlert(d: Record<string, unknown>): AlertRecord {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: String(d._id),
    deviceId: String(d.deviceId),
    timestamp: iso(d.timestamp) ?? new Date(0).toISOString(),
    category: d.category as AlertRecord['category'],
    severity: d.severity as AlertRecord['severity'],
    status: (d.status as AlertRecord['status']) ?? 'active',
    source: String(d.source ?? 'system'),
    value: Number(d.value ?? 0),
    unit: String(d.unit ?? ''),
    threshold: Number(d.threshold ?? 0),
    message: String(d.message ?? ''),
    acknowledgedAt: iso(d.acknowledgedAt),
    resolvedAt: iso(d.resolvedAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Trips                                                                       */
/* -------------------------------------------------------------------------- */

export async function getTrips(deviceId: string, from: number, to: number, limit = 60): Promise<TripRecord[]> {
  await connectToDatabase();
  const docs = await TripModel.find({ deviceId, startTime: { $gte: new Date(from), $lte: new Date(to) } })
    .sort({ startTime: -1 })
    .limit(Math.min(limit, 200))
    .lean();
  return docs.map((d) => mapTrip(d as Record<string, unknown>));
}

export async function getTrip(deviceId: string, tripId: string): Promise<TripRecord | null> {
  await connectToDatabase();
  const doc = await TripModel.findOne({ deviceId, tripId }).lean();
  if (!doc) return null;
  const trip = mapTrip(doc as Record<string, unknown>);
  const from = Date.parse(trip.startTime);
  const to = trip.endTime ? Date.parse(trip.endTime) : Date.now();
  trip.points = await getSeries(deviceId, from, to, 60);
  return trip;
}

function mapTrip(d: Record<string, unknown>): TripRecord {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: String(d.tripId),
    deviceId: String(d.deviceId),
    startTime: iso(d.startTime) ?? new Date(0).toISOString(),
    endTime: iso(d.endTime),
    distanceKm: Number(d.distanceKm ?? 0),
    startSoc: Number(d.startSoc ?? 0),
    endSoc: Number(d.endSoc ?? 0),
    energyKwh: Number(d.energyKwh ?? 0),
    avgPowerW: Number(d.avgPowerW ?? 0),
    peakPowerW: Number(d.peakPowerW ?? 0),
    avgTempC: Number(d.avgTempC ?? 0),
    maxTempC: Number(d.maxTempC ?? 0),
    solarKwh: Number(d.solarKwh ?? 0),
    fuelCellKwh: Number(d.fuelCellKwh ?? 0),
    regenerativeKwh: Number(d.regenerativeKwh ?? 0),
    efficiencyKwhPerKm: Number(d.efficiencyKwhPerKm ?? 0),
    aiEvents: Array.isArray(d.aiEvents)
      ? (d.aiEvents as Record<string, unknown>[]).map((e) => ({
          id: String(e.timestamp),
          timestamp: iso(e.timestamp) ?? new Date(0).toISOString(),
          model: e.model as AiTimelineEvent['model'],
          label: String(e.label ?? ''),
          detail: String(e.detail ?? ''),
          status: (e.status as AiTimelineEvent['status']) ?? 'ok',
        }))
      : [],
    points: [],
  };
}

/* -------------------------------------------------------------------------- */
/* AI predictions + system events                                             */
/* -------------------------------------------------------------------------- */

export async function getAiSeries(
  deviceId: string,
  model: 'soc' | 'range' | 'anomaly',
  from: number,
  to: number,
  points = 80,
) {
  await connectToDatabase();
  const pipeline: PipelineStage[] = [
    { $match: { deviceId, model, timestamp: { $gte: new Date(from), $lte: new Date(to) } } },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: { $toLong: '$timestamp' },
        value: { $last: '$prediction' },
        baseline: { $avg: '$baseline' },
        confidence: { $avg: '$confidence' },
        latencyMs: { $avg: '$latencyMs' },
        state: { $last: '$state' },
        timestamp: { $last: '$timestamp' },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: points * 6 },
  ];
  return AiPredictionModel.aggregate(pipeline).exec() as Promise<Record<string, number | string>[]>;
}

export async function getAiLatest(deviceId: string, model: 'soc' | 'range' | 'anomaly') {
  await connectToDatabase();
  const doc = await AiPredictionModel.findOne({ deviceId, model }).sort({ timestamp: -1 }).lean();
  return doc as Record<string, unknown> | null;
}

export async function getAiTimeline(deviceId: string, from: number, to: number, limit = 30): Promise<AiTimelineEvent[]> {
  await connectToDatabase();
  const docs = await AiPredictionModel.find({ deviceId, timestamp: { $gte: new Date(from), $lte: new Date(to) } })
    .sort({ timestamp: -1 })
    .limit(limit * 3)
    .lean();
  const labels: Record<string, string> = {
    soc: 'SOC inference completed',
    range: 'Range prediction updated',
    anomaly: 'No anomaly detected',
  };
  return docs
    .map((d) => {
      const r = d as Record<string, unknown>;
      const model = String(r.model) as AiTimelineEvent['model'];
      const state = String(r.state ?? 'normal');
      return {
        id: String(r._id),
        timestamp: new Date(r.timestamp as string).toISOString(),
        model,
        label: model === 'anomaly' && state !== 'normal' ? 'Anomaly signature raised' : labels[model] ?? 'Inference completed',
        detail: String(r.detail ?? `${Number(r.prediction).toFixed(3)} · confidence ${(Number(r.confidence) * 100).toFixed(1)} %`),
        status: (state === 'anomaly' ? 'critical' : state === 'warning' ? 'warning' : 'ok') as AiTimelineEvent['status'],
      };
    })
    .slice(0, limit);
}

export async function getSystemEvents(deviceId: string, limit = 20) {
  await connectToDatabase();
  const docs = await SystemEventModel.find({ deviceId }).sort({ timestamp: -1 }).limit(limit).lean();
  return docs.map((d) => {
    const r = d as Record<string, unknown>;
    return {
      id: String(r._id),
      timestamp: new Date(r.timestamp as string).toISOString(),
      type: String(r.type ?? 'info'),
      severity: String(r.severity ?? 'info'),
      message: String(r.message ?? ''),
      detail: r.detail ? String(r.detail) : '',
    };
  });
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

const SORT_MAP: Record<string, string> = {
  timestamp: 'timestamp',
  soc: 'ai.soc',
  power: 'vehicle.power',
  voltage: 'vehicle.voltage',
  current: 'vehicle.current',
  range: 'ai.range',
  t1: 'temperature.t1',
  t2: 'temperature.t2',
  t3: 'temperature.t3',
  t4: 'temperature.t4',
};

export async function getTelemetryTable(q: TelemetryTableQuery) {
  await connectToDatabase();
  const filter: Record<string, unknown> = {
    deviceId: q.deviceId,
    timestamp: { $gte: new Date(q.from), $lte: new Date(q.to) },
  };
  if (q.search) {
    const asNum = Number(q.search);
    if (Number.isFinite(asNum)) {
      filter.$or = [{ 'ai.soc': { $gte: asNum - 0.75, $lte: asNum + 0.75 } }];
    } else {
      filter.deviceId = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
  }
  const field = SORT_MAP[q.sortBy] ?? 'timestamp';
  const dir = q.sortDir === 'asc' ? 1 : -1;
  const skip = Math.max(0, (q.page - 1) * q.pageSize);

  const [docs, total] = await Promise.all([
    TelemetryModel.find(filter, PROJ)
      .sort({ [field]: dir, timestamp: dir })
      .skip(skip)
      .limit(q.pageSize)
      .lean(),
    TelemetryModel.countDocuments(filter),
  ]);

  return {
    rows: docs.map((d) => normaliseReading(d as Record<string, unknown>)),
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
  await connectToDatabase();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [telemetry, alerts, trips] = await Promise.all([
    TelemetryModel.countDocuments({ deviceId, timestamp: { $gte: since } }),
    AlertModel.countDocuments({ deviceId, status: 'active' }),
    TripModel.countDocuments({ deviceId }),
  ]);
  return { telemetry, alerts, trips };
}

/* -------------------------------------------------------------------------- */
/* Composite health                                                            */
/* -------------------------------------------------------------------------- */

export async function getChannelStates(deviceId: string): Promise<DeviceInfo['channels']> {
  const device = await getDevice(deviceId);
  if (device) return device.channels;
  return defaultChannels();
}

export function summariseThermal(reading: TelemetryReading | null) {
  if (!reading) return { min: null, max: null, avg: null, status: thermalStatus(null) as ReturnType<typeof thermalStatus> };
  return {
    min: reading.temperature.min,
    max: reading.temperature.max,
    avg: reading.temperature.avg,
    status: thermalStatus(reading.temperature.max),
  };
}

export function summariseAi(reading: TelemetryReading | null) {
  if (!reading) return { soc: null, range: null, anomalyScore: null, state: 'normal' as const };
  return {
    soc: reading.ai.soc,
    range: reading.ai.range,
    anomalyScore: reading.ai.anomalyScore,
    state: anomalyState(reading.ai.anomalyScore),
  };
}

export { isDatabaseConfigured };
