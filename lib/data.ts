import 'server-only';
import { EVISION_DEVICE_ID, DELAYED_WINDOW_S, ONLINE_WINDOW_S } from './env';
import { firebaseHealth } from './firebase';
import * as q from './firebase-queries';
import { batteryStatsFromPoints, deriveBattery, energyTotals, socSummary, statsFromPoints, summariseBuckets, thermalSummary, bucketize } from './stats';
import { AI_MODELS, HARDWARE } from './constants';
import { anomalyState, linkStateFromAge, thermalStatus } from './format';
import type {
  AiModelReport,
  AiTimelineEvent,
  AlertRecord,
  DataEnvelope,
  DataSource,
  DeviceInfo,
  LinkState,
  OverviewPayload,
  RangeStats,
  SeriesPoint,
  TelemetryReading,
  TelemetryTablePayload,
  ThermalReport,
  TimeRange,
  TripRecord,
} from '@/types';
import { buildThermalMap, thermalLimits } from './stats';

/**
 * Unified data gateway.
 *
 * Every page in the platform reads through this module. Telemetry is served
 * from Firebase Realtime Database — the firmware writes frames straight into
 * the database and this application is a pure read-and-aggregate consumer
 * (the live dashboard additionally subscribes to Firebase from the browser).
 * There is no demo/synthetic fallback: when Firebase is unreachable the
 * envelopes carry an explicit database-error empty state and the UI never
 * sees fabricated measurements.
 */

export type FleetDevice = {
  deviceId: string;
  name: string;
  source: DataSource;
  status: 'online' | 'delayed' | 'offline' | 'unknown';
  location: string;
  lastSeen: string | null;
};

export function activeDeviceId(): string {
  return EVISION_DEVICE_ID;
}

/** The platform always serves live, database-backed data. */
export function sourceFor(_deviceId: string): DataSource {
  return 'live';
}

export function deviceLabel(deviceId: string, source: DataSource): string {
  return source === 'demo' ? 'DEMO DEVICE' : 'LIVE DEVICE';
}

function envelope<T>(
  deviceId: string,
  source: DataSource,
  data: T,
  extra: { link: LinkState; lastSeen: string | null; empty?: string | null },
): DataEnvelope<T> {
  return {
    source,
    deviceId,
    deviceLabel: deviceLabel(deviceId, source),
    generatedAt: new Date().toISOString(),
    link: extra.link,
    lastSeen: extra.lastSeen,
    empty: extra.empty ?? null,
    data,
  };
}

function statusFromLastSeen(lastSeen: string | null): FleetDevice['status'] {
  if (!lastSeen) return 'unknown';
  const age = (Date.now() - Date.parse(lastSeen)) / 1000;
  return linkStateFromAge(age, ONLINE_WINDOW_S, DELAYED_WINDOW_S);
}

/* -------------------------------------------------------------------------- */
/* Fleet                                                                       */
/* -------------------------------------------------------------------------- */

export async function getFleet(): Promise<FleetDevice[]> {
  try {
    const devices = await q.listDevices();
    if (devices.length) {
      return devices.map((d) => ({
        deviceId: d.deviceId,
        name: d.name,
        source: (d.deviceId.toUpperCase().includes('DEMO') ? 'demo' : 'live') as DataSource,
        status: statusFromLastSeen(d.lastSeen),
        location: d.location,
        lastSeen: d.lastSeen,
      }));
    }
  } catch {
    /* fall through to the navigable EV-001 placeholder below */
  }
  return [
    {
      deviceId: EVISION_DEVICE_ID,
      name: 'EVISION Reference Vehicle',
      source: 'live',
      status: 'unknown',
      location: 'Awaiting first telemetry',
      lastSeen: null,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Core getters                                                                */
/* -------------------------------------------------------------------------- */

export interface CoreContext {
  deviceId: string;
  source: DataSource;
  latest: TelemetryReading | null;
  lastSeen: string | null;
  link: LinkState;
  dbError: boolean;
}

const NO_DATA_MSG = 'Waiting for telemetry…';
const OFFLINE_MSG = 'Device offline — the last known sample is shown.';
const DB_ERROR_MSG = 'Database unreachable — telemetry cannot be read. Check Firebase Realtime Database settings.';

async function loadCore(deviceId: string): Promise<CoreContext> {
  const source = sourceFor(deviceId);
  try {
    const latest = await q.getLatestReading(deviceId);
    const lastSeen = latest ? latest.timestamp : null;
    const age = lastSeen ? (Date.now() - Date.parse(lastSeen)) / 1000 : null;
    return {
      deviceId,
      source,
      latest,
      lastSeen,
      link: linkStateFromAge(age, ONLINE_WINDOW_S, DELAYED_WINDOW_S),
      dbError: false,
    };
  } catch {
    return { deviceId, source, latest: null, lastSeen: null, link: 'unknown', dbError: true };
  }
}

async function loadSeries(deviceId: string, from: number, to: number, points: number): Promise<SeriesPoint[]> {
  try {
    return await q.getSeries(deviceId, from, to, points);
  } catch {
    return [];
  }
}

/** Honest empty-state copy: distinguishes no data from a database outage. */
function emptyFor(core: CoreContext): string | null {
  if (core.latest) return null;
  if (core.dbError) return DB_ERROR_MSG;
  return core.link === 'offline' ? OFFLINE_MSG : NO_DATA_MSG;
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

export async function getOverview(deviceId: string, range: TimeRange): Promise<DataEnvelope<OverviewPayload>> {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 96);
  const stats = await q
    .getChannelSummary(core.deviceId, range.from, range.to)
    .catch(() => ({
      solar: statsFromPoints(pts, 'solar'),
      fuelCell: statsFromPoints(pts, 'fuelCell'),
      vehicle: statsFromPoints(pts, 'vehicle'),
    }));

  const battery = core.latest ? deriveBattery(core.latest) : null;
  const counts = await q.getCounts(core.deviceId).catch(() => ({ telemetry: pts.length, alerts: 0, trips: 0 }));

  const payload: OverviewPayload = {
    latest: core.latest,
    battery,
    stats,
    energy: energyTotals(pts),
    thermal: {
      min: core.latest?.temperature.min ?? null,
      max: core.latest?.temperature.max ?? null,
      avg: core.latest?.temperature.avg ?? null,
      status: thermalStatus(core.latest?.temperature.max ?? null),
    },
    ai: {
      soc: core.latest?.ai.soc ?? null,
      range: core.latest?.ai.range ?? null,
      anomalyScore: core.latest?.ai.anomalyScore ?? null,
      state: anomalyState(core.latest?.ai.anomalyScore ?? null),
      modelVersion: core.latest?.ai.modelVersion ?? null,
      modelsActive: core.latest?.ai.modelsActive ?? null,
      inferenceMs: core.latest?.ai.inferenceMs ?? null,
      isLiveInference: true,
    },
    counts,
    series: pts,
  };

  return envelope(core.deviceId, core.source, payload, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: emptyFor(core),
  });
}

/* -------------------------------------------------------------------------- */
/* Live                                                                        */
/* -------------------------------------------------------------------------- */

export async function getLive(deviceId: string, range: TimeRange) {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 120);
  const payload = {
    latest: core.latest,
    battery: core.latest ? deriveBattery(core.latest) : null,
    points: pts,
    link: core.link,
    stats: {
      solar: statsFromPoints(pts, 'solar'),
      fuelCell: statsFromPoints(pts, 'fuelCell'),
      vehicle: statsFromPoints(pts, 'vehicle'),
      battery: batteryStatsFromPoints(pts),
    },
  };
  return envelope(core.deviceId, core.source, payload, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: emptyFor(core),
  });
}

export async function getLatest(deviceId: string) {
  const core = await loadCore(deviceId);
  return envelope(
    core.deviceId,
    core.source,
    { latest: core.latest, battery: core.latest ? deriveBattery(core.latest) : null },
    { link: core.link, lastSeen: core.lastSeen, empty: emptyFor(core) },
  );
}

/* -------------------------------------------------------------------------- */
/* Battery                                                                     */
/* -------------------------------------------------------------------------- */

export async function getBattery(deviceId: string, range: TimeRange) {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 110);
  const payload = {
    latest: core.latest,
    battery: core.latest ? deriveBattery(core.latest) : null,
    points: pts,
    stats: batteryStatsFromPoints(pts),
    soc: socSummary(pts),
    thermal: thermalSummary(pts),
  };
  return envelope(core.deviceId, core.source, payload, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: emptyFor(core),
  });
}

/* -------------------------------------------------------------------------- */
/* Solar / fuel cell                                                           */
/* -------------------------------------------------------------------------- */

export async function getChannelPage(deviceId: string, channel: 'solar' | 'fuelCell', range: TimeRange) {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 110);
  const bucketMs = Math.max(3_600_000, Math.floor((range.to - range.from) / 24));
  const buckets = await q.getEnergyBuckets(core.deviceId, range.from, range.to, bucketMs).catch(() => []);
  const totals = summariseBuckets(buckets.length ? buckets : bucketize(pts, bucketMs, range.from, range.to));
  const own = channel === 'solar' ? totals.solarKwh : totals.fuelCellKwh;
  const otherKwh = channel === 'solar' ? totals.fuelCellKwh : totals.solarKwh;
  const consumed = totals.vehicleKwh;
  const denom = own + otherKwh + (consumed > 0 ? 0 : 0) || 1;

  const payload = {
    latest: core.latest,
    points: pts,
    buckets,
    stats: statsFromPoints(pts, channel),
    totals,
    contribution: Number.isFinite(own) ? (own / denom) * 100 : Number.NaN,
    share: Number.isFinite(own) ? (own / Math.max(own + otherKwh, 1e-9)) * 100 : Number.NaN,
    consumKwh: consumed,
    soc: socSummary(pts),
  };
  return envelope(core.deviceId, core.source, payload, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: emptyFor(core),
  });
}

/* -------------------------------------------------------------------------- */
/* Energy                                                                      */
/* -------------------------------------------------------------------------- */

export async function getEnergy(deviceId: string, range: TimeRange, bucketMs: number) {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 200);
  const buckets = await q.getEnergyBuckets(core.deviceId, range.from, range.to, bucketMs).catch(() => []);
  const totals = summariseBuckets(buckets.length ? buckets : bucketize(pts, bucketMs, range.from, range.to));
  const gen = totals.solarKwh + totals.fuelCellKwh;
  const payload = {
    latest: core.latest,
    points: pts,
    buckets,
    totals,
    shares: {
      solar: gen > 0 ? (totals.solarKwh / gen) * 100 : Number.NaN,
      fuelCell: gen > 0 ? (totals.fuelCellKwh / gen) * 100 : Number.NaN,
      batteryShare: gen > 0 ? (totals.batteryKwh / (gen + totals.batteryKwh || 1)) * 100 : Number.NaN,
      consumption: gen > 0 ? (totals.vehicleKwh / Math.max(gen, totals.vehicleKwh)) * 100 : Number.NaN,
    },
    flow: {
      solar: Math.max(0, core.latest?.solar.power ?? 0),
      fuelCell: Math.max(0, core.latest?.fuelCell.power ?? 0),
      vehicle: Math.max(0, core.latest?.vehicle.power ?? 0),
      battery: core.latest ? deriveBattery(core.latest).netPowerW : 0,
    },
  };
  return envelope(core.deviceId, core.source, payload, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: emptyFor(core),
  });
}

/* -------------------------------------------------------------------------- */
/* AI                                                                          */
/* -------------------------------------------------------------------------- */

export async function getAi(deviceId: string, range: TimeRange) {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 90);

  const models: AiModelReport[] = await Promise.all(
    AI_MODELS.map(async (m) => {
      const rows = await q.getAiSeries(core.deviceId, m.key, range.from, range.to, 60).catch(() => []);
      const last = await q.getAiLatest(core.deviceId, m.key).catch(() => null);
      const series = rows.map((r) => ({
        t: Number(r.t ?? r.timestamp),
        value: Number(r.value ?? 0),
        baseline: Number(r.baseline ?? 0),
      }));
      return {
        key: m.key,
        index: m.index,
        name: m.name,
        description: m.description,
        state: anomalyState(series.at(-1)?.value ?? 0) as AiModelReport['state'],
        confidence: Number(last?.confidence ?? 0),
        latencyMs: Number(last?.latencyMs ?? 0),
        samples: Number(last ? 1 : 0) * (rows.length || 0),
        lastInference: last ? new Date(last.timestamp as string).toISOString() : core.lastSeen,
        metrics: [
          { label: 'Latest prediction', value: series.at(-1) ? series.at(-1)!.value.toFixed(3) : '—', hint: m.short },
          { label: 'Window peak', value: series.length ? Math.max(...series.map((s) => s.value)).toFixed(3) : '—', hint: 'Max across window' },
          { label: 'Window mean', value: series.length ? (series.reduce((a, s) => a + s.value, 0) / series.length).toFixed(3) : '—', hint: 'Average inference' },
          { label: 'Samples', value: String(series.length), hint: 'Downsampled for chart' },
        ],
        series,
      };
    }),
  );

  const timeline: AiTimelineEvent[] = await q.getAiTimeline(core.deviceId, range.from, range.to, 30).catch(() => []);

  const score = core.latest?.ai.anomalyScore ?? null;
  const payload = {
    latest: core.latest,
    models,
    timeline,
    points: pts,
    edge: {
      mcu: HARDWARE.mcu,
      runtime: HARDWARE.aiRuntime,
      modelsActive: core.latest?.ai.modelsActive ?? 0,
      inferenceMs: core.latest?.ai.inferenceMs ?? null,
      horizonS: core.latest?.ai.horizonS ?? 180,
      samplesEvaluated: models.reduce((a, m) => a + m.samples, 0),
      health: anomalyState(score),
    },
  };
  return envelope(core.deviceId, core.source, payload, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: emptyFor(core),
  });
}

/* -------------------------------------------------------------------------- */
/* Thermal                                                                     */
/* -------------------------------------------------------------------------- */

export async function getThermal(deviceId: string, range: TimeRange) {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 110);
  // No reading and "reading of NaN" both mean the same thing to the UI: N/A.
  const NONE = null;
  const t = core.latest?.temperature ?? { t1: NONE, t2: NONE, t3: NONE, t4: NONE, min: NONE, max: NONE, avg: NONE };
  const summary = thermalSummary(pts);
  // Window aggregates win; fall back to the latest frame; otherwise there is
  // simply no thermal data and every field stays null.
  const pick = (fromSeries: number, fromLatest: number | null): number | null => {
    if (Number.isFinite(fromSeries)) return fromSeries;
    if (typeof fromLatest === 'number' && Number.isFinite(fromLatest)) return fromLatest;
    return null;
  };
  const max = pick(summary.max, t.max);
  const min = pick(summary.min, t.min);
  const avg = pick(summary.avg, t.avg);
  const report: ThermalReport = {
    sensors: [
      { key: 't1', label: 'T1', zone: 'Photovoltaic roof array', value: t.t1 },
      { key: 't2', label: 'T2', zone: 'Fuel-cell stack & humidifier', value: t.t2 },
      { key: 't3', label: 'T3', zone: 'Traction inverter & motor', value: t.t3 },
      { key: 't4', label: 'T4', zone: 'Battery enclosure & BMS', value: t.t4 },
    ],
    min,
    max,
    avg,
    delta: max != null && min != null ? max - min : null,
    status: thermalStatus(max),
    series: pts.map((p) => ({ t: p.t, t1: p.t1, t2: p.t2, t3: p.t3, t4: p.t4 })),
    map: buildThermalMap(t),
    limits: thermalLimits(max),
  };
  return envelope(core.deviceId, core.source, report, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: emptyFor(core),
  });
}

/* -------------------------------------------------------------------------- */
/* Alerts                                                                      */
/* -------------------------------------------------------------------------- */

export async function getAlerts(
  deviceId: string,
  range: TimeRange,
  filters: { severity?: string[]; category?: string[]; status?: string[]; search?: string },
) {
  const core = await loadCore(deviceId);
  let alerts: AlertRecord[] = await q.getAlerts({ deviceId, from: range.from, to: range.to, ...filters }).catch(() => []);
  if (filters.severity?.length) alerts = alerts.filter((a) => filters.severity!.includes(a.severity));
  if (filters.category?.length) alerts = alerts.filter((a) => filters.category!.includes(a.category));
  if (filters.status?.length) alerts = alerts.filter((a) => filters.status!.includes(a.status));
  if (filters.search) {
    const s = filters.search.toLowerCase();
    alerts = alerts.filter((a) => `${a.message} ${a.source} ${a.category}`.toLowerCase().includes(s));
  }
  const summary = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    active: alerts.filter((a) => a.status === 'active').length,
  };
  return envelope(core.deviceId, core.source, { alerts, summary }, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: alerts.length ? null : ('No alerts raised in the selected window.'),
  });
}

/* -------------------------------------------------------------------------- */
/* Trips                                                                       */
/* -------------------------------------------------------------------------- */

export async function getTrips(deviceId: string, range: TimeRange) {
  const core = await loadCore(deviceId);
  const trips = await q.getTrips(core.deviceId, range.from, range.to).catch(() => []);
  const totals = trips.reduce(
    (a, t) => ({
      distanceKm: a.distanceKm + t.distanceKm,
      energyKwh: a.energyKwh + t.energyKwh,
      solarKwh: a.solarKwh + t.solarKwh,
      fuelCellKwh: a.fuelCellKwh + t.fuelCellKwh,
      regenKwh: a.regenKwh + t.regenerativeKwh,
      socDrop: a.socDrop + Math.max(0, t.startSoc - t.endSoc),
    }),
    { distanceKm: 0, energyKwh: 0, solarKwh: 0, fuelCellKwh: 0, regenKwh: 0, socDrop: 0 },
  );
  return envelope(core.deviceId, core.source, { trips, totals }, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: trips.length ? null : ('No trips recorded in the selected window.'),
  });
}

export async function getTrip(deviceId: string, tripId: string) {
  const core = await loadCore(deviceId);
  const trip: TripRecord | null = await q.getTrip(core.deviceId, tripId).catch(() => null);
  return envelope(core.deviceId, core.source, trip, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: trip ? null : ('Trip not found.'),
  });
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

export async function getAnalytics(deviceId: string, range: TimeRange, bucketMs?: number) {
  const core = await loadCore(deviceId);
  const pts = await loadSeries(core.deviceId, range.from, range.to, 140);
  const bucketSize = Math.max(60_000, Math.min(bucketMs ?? Math.floor((range.to - range.from) / 30), range.bucketMs * 4));
  const buckets = await q.getEnergyBuckets(core.deviceId, range.from, range.to, bucketSize).catch(() => []);
  const totals = summariseBuckets(buckets.length ? buckets : bucketize(pts, bucketSize, range.from, range.to));
  const vehicleStats = statsFromPoints(pts, 'vehicle');
  const stats: RangeStats = {
    solar: statsFromPoints(pts, 'solar'),
    fuelCell: statsFromPoints(pts, 'fuelCell'),
    vehicle: vehicleStats,
    battery: batteryStatsFromPoints(pts),
    energy: totals,
    soc: socSummary(pts),
    thermal: thermalSummary(pts),
    peakPowerW: vehicleStats.powerPeak,
    avgPowerW: vehicleStats.powerAvg,
  };
  return envelope(core.deviceId, core.source, { points: pts, buckets, stats, latest: core.latest }, {
    link: core.link,
    lastSeen: core.lastSeen,
    empty: pts.length ? null : ('No telemetry inside the selected window.'),
  });
}

/* -------------------------------------------------------------------------- */
/* Device + health                                                             */
/* -------------------------------------------------------------------------- */

export async function getDevicePage(deviceId: string) {
  const [device, events, latest] = await Promise.all([
    q.getDevice(deviceId).catch(() => null),
    q.getSystemEvents(deviceId, 18).catch(() => []),
    q.getLatestReading(deviceId).catch(() => null),
  ]);
  const fallback: DeviceInfo = {
    deviceId,
    name: deviceId,
    model: 'EVISION Edge Node EN-3',
    mcu: HARDWARE.mcu,
    firmware: latest?.meta?.firmware ?? 'unknown',
    location: 'Unregistered device — insert a `devices` document',
    status: 'offline',
    lastSeen: latest?.timestamp ?? null,
    registeredAt: new Date(0).toISOString(),
    channels: [
      { id: 'pzem-1', label: 'SOLAR PZEM', address: '0x01', role: 'SOLAR', state: 'no-data', lastReading: latest?.timestamp ?? null },
      { id: 'pzem-2', label: 'FUEL CELL PZEM', address: '0x02', role: 'FUEL_CELL', state: 'no-data', lastReading: latest?.timestamp ?? null },
      { id: 'pzem-3', label: 'LOAD PZEM', address: '0x03', role: 'LOAD', state: 'no-data', lastReading: latest?.timestamp ?? null },
    ],
    temperatureSensors: 4,
    storage: 'sd-card',
    aiModels: ['soc-prediction', 'range-prediction', 'anomaly-detection'],
  };
  const hardware = {
    firmware: latest?.meta?.firmware ?? fallback.firmware,
    ip: latest?.meta?.ip ?? null,
    rssi: latest?.meta?.rssi ?? null,
    uptimeS: latest?.meta?.uptimeS ?? null,
    freeHeapBytes: latest?.meta?.freeHeap ?? null,
    sdFreeMb: latest?.meta?.sdFreeMb ?? null,
    mqttTopic: latest?.meta?.mqttTopic ?? null,
    battery: latest ? deriveBattery(latest) : null,
    node: {
      wifi: latest?.wifi ?? null,
      sd: latest?.status?.sd ?? null,
      cloud: latest?.status?.cloud ?? null,
      uptimeS: latest?.deviceUptimeMs != null ? Math.round(latest.deviceUptimeMs / 1000) : (latest?.meta?.uptimeS ?? null),
    },
  };
  const link = statusFromLastSeen(latest?.timestamp ?? null);
  return envelope(deviceId, 'live', { device: device ?? fallback, hardware, events }, {
    link,
    lastSeen: latest?.timestamp ?? null,
    empty: emptyFor({ deviceId, source: 'live', latest, lastSeen: latest?.timestamp ?? null, link, dbError: false }),
  });
}

export async function getHealth() {
  const h = await firebaseHealth();
  return h;
}

/* -------------------------------------------------------------------------- */
/* Raw telemetry table                                                         */
/* -------------------------------------------------------------------------- */

export interface TelemetryPageQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
}

/** Paginated raw-frame view used by the Data page. */
export async function getTelemetryPage(
  deviceId: string,
  range: TimeRange,
  query: TelemetryPageQuery = {},
): Promise<DataEnvelope<TelemetryTablePayload>> {
  const core = await loadCore(deviceId);
  const merged = {
    deviceId: core.deviceId,
    from: range.from,
    to: range.to,
    page: query.page ?? 1,
    pageSize: Math.min(200, Math.max(10, query.pageSize ?? 25)),
    sortBy: query.sortBy ?? 'timestamp',
    sortDir: query.sortDir ?? ('desc' as const),
    search: query.search ?? '',
  };
  const result = await q.getTelemetryTable(merged).catch(() => ({ rows: [], total: 0, page: 1, pages: 1 }));
  return envelope(
    core.deviceId,
    core.source,
    { deviceId: core.deviceId, rows: result.rows, total: result.total, page: result.page, pages: result.pages },
    {
      link: core.link,
      lastSeen: core.lastSeen,
      empty: core.dbError ? emptyFor(core) : result.total ? null : ('No telemetry documents match this window, filter or sort.'),
    },
  );
}