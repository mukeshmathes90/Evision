import { Schema, model, models, type Model } from 'mongoose';
import { MONGODB_COLLECTIONS } from '@/lib/env';
import type {
  AlertRecord,
  TelemetryReading,
  TripRecord,
} from '@/types';

/**
 * Mongoose models mirroring the MongoDB Atlas collections.
 *
 * Index strategy: every query in `lib/queries.ts` filters by `deviceId` and/or
 * sorts/scans on `timestamp`, so those two fields are indexed â€” the compound
 * `{ deviceId, timestamp }` index serves both dashboard reads and range scans,
 * while the single-field `timestamp` index supports cross-device fleet views.
 */

/* -------------------------------------------------------------------------- */
/* devices                                                                     */
/* -------------------------------------------------------------------------- */

const PzemChannelSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    address: { type: String, required: true },
    role: { type: String, enum: ['SOLAR', 'FUEL_CELL', 'LOAD'], required: true },
    state: { type: String, enum: ['connected', 'no-data', 'offline'], default: 'no-data' },
    lastReading: { type: Date, default: null },
    lastAddressPoll: { type: Date, default: null },
  },
  { _id: false },
);

const DeviceSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true },
    model: { type: String, default: 'EVISION Edge Node' },
    mcu: { type: String, default: 'ESP32-S3 N16R8' },
    firmware: { type: String, default: '1.0.0' },
    hardwareRevision: { type: String, default: 'rev-A' },
    location: { type: String, default: 'Unassigned' },
    status: { type: String, enum: ['online', 'offline', 'maintenance'], default: 'offline', index: true },
    lastSeen: { type: Date, default: null, index: true },
    registeredAt: { type: Date, default: () => new Date() },
    channels: { type: [PzemChannelSchema], default: () => [] },
    temperatureSensors: { type: Number, default: 4 },
    temperatureModel: { type: String, default: 'DS18B20' },
    storage: { type: String, enum: ['sd-card', 'none'], default: 'sd-card' },
    aiModels: { type: [String], default: () => ['soc', 'range', 'anomaly'] },
    ip: { type: String, default: null },
    rssi: { type: Number, default: null },
    uptimeS: { type: Number, default: null },
    freeHeapBytes: { type: Number, default: null },
    sdFreeMb: { type: Number, default: null },
samplingIntervalMs: { type: Number, default: 1000 },
    tags: { type: [String], default: () => [] },
    notes: { type: String, default: '' },

    /* --- current state, refreshed on every telemetry POST -------------------
     * These fields are the reason a dashboard card needs a single document read
     * instead of a scan over the telemetry history collection.              */
    batterySoc: { type: Number, default: null },
    batteryMode: { type: String, enum: ['charging', 'discharging', 'idle'], default: null },
    netPowerW: { type: Number, default: null },
    tempMaxC: { type: Number, default: null },
    aiSoc: { type: Number, default: null },
    aiRangeKm: { type: Number, default: null },
    aiAnomalyScore: { type: Number, default: null },
    wifi: { type: Boolean, default: null },
    sdState: { type: Boolean, default: null },
    cloudState: { type: Boolean, default: null },
    channelStates: {
      solar: { type: String, default: null },
      fuelCell: { type: String, default: null },
      vehicle: { type: String, default: null },
    },
  },
  { timestamps: true, collection: MONGODB_COLLECTIONS.devices },
);

DeviceSchema.index({ status: 1, lastSeen: -1 });

export type DeviceDoc = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* telemetry                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Channel fields are nullable by design. A PZEM that fails CRC reports
 * `valid: false`, and the firmware may post nulls. Storing 0 instead would be
 * indistinguishable from a real zero-watt reading, so null is preserved and the
 * UI renders it as `N/A`.
 */
const ChannelSchema = new Schema(
  {
    voltage: { type: Number, default: null },
    current: { type: Number, default: null },
    power: { type: Number, default: null },
    energy: { type: Number, default: null },
    valid: { type: Boolean, default: true },
    frequency: { type: Number, default: null },
    powerFactor: { type: Number, default: null },
  },
  { _id: false },
);

/** A probe that is not fitted (or has a bad CRC) stays null — never 0 °C. */
const TemperatureSchema = new Schema(
  {
    t1: { type: Number, default: null },
    t2: { type: Number, default: null },
    t3: { type: Number, default: null },
    t4: { type: Number, default: null },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    avg: { type: Number, default: null },
  },
  { _id: false },
);

const AiSchema = new Schema(
  {
    soc: { type: Number, default: null },
    range: { type: Number, default: null },
    anomalyScore: { type: Number, default: null },
    anomaly: { type: Boolean, default: false },
    socConfidence: { type: Number, default: null },
    rangeConfidence: { type: Number, default: null },
    horizonS: { type: Number, default: 180 },
    inferenceMs: { type: Number, default: null },
    modelsActive: { type: Number, default: 7 },
    modelVersion: { type: String, default: 'edge-v1' },
  },
  { _id: false },
);

const TelemetrySchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true, trim: true },
    timestamp: { type: Date, required: true, index: true },
    solar: { type: ChannelSchema, required: true },
    fuelCell: { type: ChannelSchema, required: true },
    vehicle: { type: ChannelSchema, required: true },
    temperature: { type: TemperatureSchema, required: true },
ai: { type: AiSchema, required: true },
    battery: {
      soc: { type: Number, default: null },
      mode: { type: String, enum: ['charging', 'discharging', 'idle'], default: 'idle' },
      netPowerW: { type: Number, default: null },
      condition: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' },
      healthPct: { type: Number, default: null },
      cycles: { type: Number, default: null },
      cellVoltage: { type: Number, default: null },
      cellCount: { type: Number, default: null },
    },
    /** Firmware-reported node health, mirrored into the `devices` document. */
    wifi: { type: Boolean, default: null },
    deviceUptimeMs: { type: Number, default: null },
    status: {
      sd: { type: Boolean, default: null },
      cloud: { type: Boolean, default: null },
      queue: { type: Number, default: null },
    },
    /** Edge model load status as reported by the node. */
    models: {
      soc: { type: Boolean, default: null },
      range: { type: Boolean, default: null },
      anomaly: { type: Boolean, default: null },
      _id: false,
    },
    meta: {
      firmware: { type: String, default: null },
      ip: { type: String, default: null },
      rssi: { type: Number, default: null },
      uptimeS: { type: Number, default: null },
      freeHeap: { type: Number, default: null },
      sdFreeMb: { type: Number, default: null },
      mqttTopic: { type: String, default: null },
    },
    sequence: { type: Number, default: null },
    ingestMs: { type: Number, default: null },
  },
  { timestamps: false, collection: MONGODB_COLLECTIONS.telemetry, versionKey: false },
);

// Primary serving index: every dashboard read is scoped by device and window.
TelemetrySchema.index({ deviceId: 1, timestamp: -1 });
// Fleet-wide time scans (device selector rollups, cross-device analytics).
TelemetrySchema.index({ timestamp: -1 });
// Sparse index so alert generation can query "anomalous frames" cheaply.
TelemetrySchema.index({ deviceId: 1, 'ai.anomalyScore': -1 }, { sparse: true });

export type TelemetryDoc = Omit<TelemetryReading, 'deviceId' | 'timestamp'> & { deviceId: string; timestamp: Date };

/* -------------------------------------------------------------------------- */
/* ai_predictions                                                              */
/* -------------------------------------------------------------------------- */

const AiPredictionSchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true, trim: true },
    timestamp: { type: Date, required: true, index: true },
    model: { type: String, enum: ['soc', 'range', 'anomaly'], required: true },
    prediction: { type: Number, required: true },
    actual: { type: Number, default: null },
    baseline: { type: Number, default: null },
    confidence: { type: Number, required: true },
    latencyMs: { type: Number, required: true },
    state: { type: String, enum: ['normal', 'warning', 'anomaly'], default: 'normal', index: true },
    features: { type: [Number], default: undefined },
    label: { type: String, default: null },
    detail: { type: String, default: null },
    modelVersion: { type: String, default: 'edge-v1' },
  },
  { timestamps: true, collection: MONGODB_COLLECTIONS.aiPredictions, versionKey: false },
);

AiPredictionSchema.index({ deviceId: 1, model: 1, timestamp: -1 });

export type AiPredictionDoc = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* alerts                                                                      */
/* -------------------------------------------------------------------------- */

const AlertSchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true, trim: true },
    timestamp: { type: Date, required: true, index: true },
    category: {
      type: String,
      enum: [
        'high-temperature',
        'low-soc',
        'high-current',
        'high-power',
        'abnormal-voltage',
        'comm-failure',
        'ai-anomaly',
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['info', 'warning', 'critical'], required: true, index: true },
    status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active', index: true },
    source: { type: String, required: true },
    sensor: { type: String, default: null },
    value: { type: Number, required: true },
    unit: { type: String, default: '' },
    threshold: { type: Number, required: true },
    message: { type: String, required: true },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    acknowledgedBy: { type: String, default: null },
    telemetryRef: { type: Schema.Types.ObjectId, ref: 'Telemetry', default: null },
  },
  { timestamps: true, collection: MONGODB_COLLECTIONS.alerts, versionKey: false },
);

AlertSchema.index({ deviceId: 1, status: 1, timestamp: -1 });
AlertSchema.index({ deviceId: 1, category: 1, timestamp: -1 });

export type AlertDoc = AlertRecord;

/* -------------------------------------------------------------------------- */
/* trips                                                                       */
/* -------------------------------------------------------------------------- */

const TripSchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true, trim: true },
    tripId: { type: String, required: true, unique: true, index: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, default: null, index: true },
    distanceKm: { type: Number, required: true },
    startSoc: { type: Number, required: true },
    endSoc: { type: Number, required: true },
    energyKwh: { type: Number, required: true },
    avgPowerW: { type: Number, required: true },
    peakPowerW: { type: Number, required: true },
    avgTempC: { type: Number, required: true },
    maxTempC: { type: Number, required: true },
    solarKwh: { type: Number, default: 0 },
    fuelCellKwh: { type: Number, default: 0 },
    regenerativeKwh: { type: Number, default: 0 },
    efficiencyKwhPerKm: { type: Number, required: true },
    startLocation: { type: String, default: 'Depot' },
    endLocation: { type: String, default: 'Depot' },
    aiEvents: {
      type: [
        new Schema(
          {
            timestamp: { type: Date, required: true },
            model: { type: String, enum: ['soc', 'range', 'anomaly'], required: true },
            label: { type: String, required: true },
            detail: { type: String, required: true },
            status: { type: String, enum: ['ok', 'warning', 'critical'], default: 'ok' },
          },
          { _id: false },
        ),
      ],
      default: () => [],
    },
  },
  { timestamps: true, collection: MONGODB_COLLECTIONS.trips, versionKey: false },
);

TripSchema.index({ deviceId: 1, startTime: -1 });

export type TripDoc = TripRecord;

/* -------------------------------------------------------------------------- */
/* energy_sessions                                                             */
/* -------------------------------------------------------------------------- */

const EnergySessionSchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true, trim: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, default: null },
    bucket: { type: String, enum: ['hour', 'day', 'week', 'month', 'trip'], default: 'day' },
    solarKwh: { type: Number, default: 0 },
    fuelCellKwh: { type: Number, default: 0 },
    vehicleKwh: { type: Number, default: 0 },
    batteryKwh: { type: Number, default: 0 },
    netKwh: { type: Number, default: 0 },
    regenerativeKwh: { type: Number, default: 0 },
    peakPowerW: { type: Number, default: 0 },
    avgPowerW: { type: Number, default: 0 },
    startSoc: { type: Number, default: null },
    endSoc: { type: Number, default: null },
    avgTempC: { type: Number, default: null },
    maxTempC: { type: Number, default: null },
  },
  { timestamps: true, collection: MONGODB_COLLECTIONS.energySessions, versionKey: false },
);

EnergySessionSchema.index({ deviceId: 1, startTime: -1 });
EnergySessionSchema.index({ deviceId: 1, bucket: 1, startTime: -1 });

export type EnergySessionDoc = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* system_events                                                               */
/* -------------------------------------------------------------------------- */

const SystemEventSchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true, trim: true },
    timestamp: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ['boot', 'wifi', 'mqtt', 'database-write', 'sensor', 'ai', 'firmware', 'error', 'maintenance', 'info'],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['debug', 'info', 'warning', 'critical'], default: 'info' },
    message: { type: String, required: true },
    detail: { type: String, default: null },
    durationMs: { type: Number, default: null },
    firmware: { type: String, default: null },
    uptimeS: { type: Number, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: MONGODB_COLLECTIONS.systemEvents, versionKey: false },
);

SystemEventSchema.index({ deviceId: 1, timestamp: -1 });
SystemEventSchema.index({ deviceId: 1, type: 1, timestamp: -1 });

export type SystemEventDoc = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* Safe model resolution (re-registration safe under Next.js hot reload)       */
/* -------------------------------------------------------------------------- */

/**
 * Mongoose's `model<T>()` overload resolution is pathologically expensive to
 * typecheck here, so model registration is intentionally untyped at the
 * boundary. Every consumer normalises documents through `Record<string, unknown>`
 * casts and the shared domain types in `@/types`.
 */
function reg(name: string, schema: Schema): Model<Record<string, unknown>> {
  const existing = models[name] as Model<Record<string, unknown>> | undefined;
  if (existing) return existing;
  return model(name, schema) as unknown as Model<Record<string, unknown>>;
}

export const DeviceModel = reg('Device', DeviceSchema);
export const TelemetryModel = reg('Telemetry', TelemetrySchema);
export const AiPredictionModel = reg('AiPrediction', AiPredictionSchema);
export const AlertModel = reg('Alert', AlertSchema);
export const TripModel = reg('Trip', TripSchema);
export const EnergySessionModel = reg('EnergySession', EnergySessionSchema);
export const SystemEventModel = reg('SystemEvent', SystemEventSchema);

/**
 * Ensure the declared indexes exist in Atlas. Index creation is idempotent so
 * this is safe to call on every cold start; it is also invoked by the seed
 * script so a brand-new cluster is query-ready.
 */
export async function ensureIndexes(): Promise<string[]> {
  const created: string[] = [];
  for (const m of [
    TelemetryModel,
    DeviceModel,
    AiPredictionModel,
    AlertModel,
    TripModel,
    EnergySessionModel,
    SystemEventModel,
  ]) {
    try {
      created.push(...(await m.syncIndexes()));
    } catch {
      /* index sync is best-effort; never block a request on it */
    }
  }
  return created;
}

export const MODEL_NAMES = {
  devices: 'Device',
  telemetry: 'Telemetry',
  aiPredictions: 'AiPrediction',
  alerts: 'Alert',
  trips: 'Trip',
  energySessions: 'EnergySession',
  systemEvents: 'SystemEvent',
} as const;

