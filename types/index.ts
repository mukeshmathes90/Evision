/**
 * EVISION AI — shared domain types.
 *
 * These types mirror the exact telemetry document shape the ESP32-S3 firmware
 * writes into MongoDB Atlas. Keeping them in one place means the website can
 * evolve with additional fields without touching every component.
 */

/**
 * Single PZEM-017 measurement channel.
 *
 * Every field is nullable. The ESP32 reports `valid: false` when a Modbus frame
 * fails CRC or times out; storing that as `0` would be fabricating a measurement,
 * so `null` is preserved all the way to the UI, which renders it as `N/A`.
 */
export interface ChannelReading {
  /** Instantaneous voltage in volts (V). */
  voltage: number | null;
  /** Signed current in amperes (A). Negative = source delivering power. */
  current: number | null;
  /** Instantaneous power in watts (W). */
  power: number | null;
  /** Cumulative energy in kilowatt-hours (kWh). */
  energy: number | null;
  /** True when the firmware obtained a valid CRC-checked frame. */
  valid: boolean;
}

/** The three PZEM-017 channels wired to the controller. */
export interface PowerChannels {
  /** PZEM #1 — addr 0x01 — photovoltaic array. */
  solar: ChannelReading;
  /** PZEM #2 — addr 0x02 — hydrogen fuel-cell stack. */
  fuelCell: ChannelReading;
  /** PZEM #3 — addr 0x03 — 48 V traction battery / vehicle bus. */
  vehicle: ChannelReading;
}

/**
 * Four DS18B20 probes (T1..T4) plus aggregates.
 *
 * Probes are nullable because the bus supports fewer than four sensors and a
 * failed CRC must surface as `N/A` rather than a fabricated reading.
 * `min` / `max` / `avg` are computed server-side from the valid probes only.
 */
export interface TemperatureReading {
  t1: number | null;
  t2: number | null;
  t3: number | null;
  t4: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
}

/** On-device (edge) inference output. The ESP32 runs all three models itself. */
export interface AiReading {
  /** State of charge, percent. */
  soc: number | null;
  /** Estimated remaining range, kilometres. */
  range: number | null;
  /** Normalised anomaly score, 0..1 (higher = more abnormal). */
  anomalyScore: number | null;
  /** Firmware boolean flag that mirrors `anomalyScore`. */
  anomaly?: boolean;
  /** Model identity/version reported by the firmware, e.g. `edge-v1`. */
  modelVersion?: string;
  /** Horizon in seconds the SOC/range model looks ahead. */
  horizonS?: number;
  /** Edge inference latency in milliseconds. */
  inferenceMs?: number;
  /** Bitmask of active models: 1 = SOC, 2 = range, 4 = anomaly. */
  modelsActive?: number;
}

/** Firmware-reported health flags from the POST payload. */
export interface DeviceStatusFlags {
  /** MicroSD logging state. */
  sd: boolean | null;
  /** Last cloud POST succeeded. */
  cloud: boolean | null;
}

/** A single telemetry document as persisted in the `telemetry` collection. */
export interface TelemetryReading {
  deviceId: string;
  /** ISO-8601 timestamp produced by the device clock (UTC). */
  timestamp: string;
  solar: ChannelReading;
  fuelCell: ChannelReading;
  vehicle: ChannelReading;
  temperature: TemperatureReading;
  ai: AiReading;
  /** Battery / vehicle bus derived state, stored by firmware for fast reads. */
  battery?: BatteryState;
  /** Wi-Fi association state reported by the node. */
  wifi?: boolean | null;
  /** Milliseconds since boot. */
  deviceUptimeMs?: number | null;
  /** MicroSD / cloud flags reported by the node. */
  status?: DeviceStatusFlags;
  /** Free-form firmware health block — safe to extend without schema changes. */
  meta?: {
    firmware?: string;
    ip?: string;
    rssi?: number;
    uptimeS?: number;
    freeHeap?: number;
    sdFreeMb?: number;
    mqttTopic?: string;
  };
}

/** Battery behaviour classification derived on the server from telemetry. */
export interface BatteryState {
  soc: number;
  mode: 'charging' | 'discharging' | 'idle';
  /** Net battery power in W; positive = charging. */
  netPowerW: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  healthPct: number;
  cycles: number;
  cellVoltage: number;
  cellCount: number;
}

/** One downsampled point for charting. Null = the probe/channel had no valid reading. */
export interface SeriesPoint {
  t: number;
  solarPower: number | null;
  fuelCellPower: number | null;
  vehiclePower: number | null;
  batteryPower: number | null;
  solarCurrent: number | null;
  fuelCellCurrent: number | null;
  vehicleCurrent: number | null;
  batteryCurrent: number | null;
  voltage: number | null;
  solarVoltage: number | null;
  fuelCellVoltage: number | null;
  vehicleVoltage: number | null;
  soc: number | null;
  range: number | null;
  anomalyScore: number | null;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  t4: number | null;
  tempAvg: number | null;
  tempMax: number | null;
  energy: EnergyTotals;
}

/** Aggregated energy counters over a window. */
export interface EnergyTotals {
  solarKwh: number;
  fuelCellKwh: number;
  batteryKwh: number;
  vehicleKwh: number;
  netKwh: number;
  regenerativeKwh: number;
}

/** Channel-level statistics computed by an aggregation pipeline. */
export interface ChannelStats {
  voltageAvg: number;
  voltagePeak: number;
  voltageMin: number;
  currentAvg: number;
  currentPeak: number;
  powerAvg: number;
  powerPeak: number;
  energyDelta: number;
  samples: number;
  activeRatio: number;
}

/** Daily energy rollup used by the Energy and Analytics pages. */
export interface EnergyBucket {
  /** Bucket start, ISO string. */
  t: number;
  label: string;
  solarKwh: number;
  fuelCellKwh: number;
  vehicleKwh: number;
  batteryKwh: number;
  netKwh: number;
  avgPowerW: number;
  peakPowerW: number;
  socAvg: number;
  tempAvg: number;
}

/** Connection health of the fleet, derived from MongoDB timestamps. */
export type LinkState = 'online' | 'delayed' | 'offline' | 'unknown';

/** Device descriptor stored in the `devices` collection. */
export interface DeviceInfo {
  deviceId: string;
  name: string;
  model: string;
  mcu: string;
  firmware: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  lastSeen: string | null;
  registeredAt: string;
  channels: PzemChannelStatus[];
  temperatureSensors: number;
  storage: 'sd-card' | 'none';
  aiModels: string[];
}

export interface PzemChannelStatus {
  id: string;
  label: string;
  address: string;
  role: 'SOLAR' | 'FUEL_CELL' | 'LOAD';
  state: 'connected' | 'no-data' | 'offline';
  lastReading: string | null;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertCategory =
  | 'high-temperature'
  | 'low-soc'
  | 'high-current'
  | 'high-power'
  | 'abnormal-voltage'
  | 'comm-failure'
  | 'ai-anomaly';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlertRecord {
  id: string;
  deviceId: string;
  timestamp: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  value: number;
  unit: string;
  threshold: number;
  message: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

export interface TripRecord {
  id: string;
  deviceId: string;
  startTime: string;
  endTime: string | null;
  distanceKm: number;
  startSoc: number;
  endSoc: number;
  energyKwh: number;
  avgPowerW: number;
  peakPowerW: number;
  avgTempC: number;
  maxTempC: number;
  solarKwh: number;
  fuelCellKwh: number;
  regenerativeKwh: number;
  efficiencyKwhPerKm: number;
  aiEvents: AiTimelineEvent[];
  points: SeriesPoint[];
}

export interface AiTimelineEvent {
  id: string;
  timestamp: string;
  model: 'soc' | 'range' | 'anomaly';
  label: string;
  detail: string;
  status: 'ok' | 'warning' | 'critical';
}

export type AiModelState = 'normal' | 'warning' | 'anomaly';

export interface AiModelReport {
  key: 'soc' | 'range' | 'anomaly';
  index: string;
  name: string;
  description: string;
  state: AiModelState;
  confidence: number;
  latencyMs: number;
  samples: number;
  lastInference: string | null;
metrics: { label: string; value: string; hint: string }[];
  /** `value`/`baseline` are null when the model produced no usable output. */
  series: { t: number; value: number | null; baseline: number | null }[];
}

export type ThermalStatus = 'normal' | 'warm' | 'high' | 'critical';

export interface ThermalReport {
  sensors: { key: 't1' | 't2' | 't3' | 't4'; label: string; zone: string; value: number | null }[];
  min: number | null;
  max: number | null;
  avg: number | null;
  delta: number | null;
  status: ThermalStatus;
  series: { t: number; t1: number | null; t2: number | null; t3: number | null; t4: number | null }[];
  map: ThermalCell[];
  limits: { label: string; value: number }[];
}

export interface ThermalCell {
  label: string;
  /** Null when the backing probe returned no valid reading. */
  tempC: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the numbers on screen came from. Never mix the two sources. */
export type DataSource = 'live' | 'demo';

export interface DataEnvelope<T> {
  source: DataSource;
  deviceId: string;
  deviceLabel: string;
  generatedAt: string;
  link: LinkState;
  lastSeen: string | null;
  /** Human readable reason shown when a dataset is empty. */
  empty?: string | null;
  data: T;
}

export interface OverviewPayload {
  latest: TelemetryReading | null;
  battery: BatteryState | null;
  stats: {
    solar: ChannelStats | null;
    fuelCell: ChannelStats | null;
    vehicle: ChannelStats | null;
  };
  energy: EnergyTotals;
thermal: {
    min: number | null;
    max: number | null;
    avg: number | null;
    status: ThermalStatus;
  };
  ai: {
    soc: number | null;
    range: number | null;
    anomalyScore: number | null;
    state: AiModelState;
    /** Firmware-reported model identity, absent when the node did not send one. */
    modelVersion: string | null;
    modelsActive: number | null;
    inferenceMs: number | null;
    /** True only when the backend confirms these are real inference outputs. */
    isLiveInference: boolean;
  };
  counts: { telemetry: number; alerts: number; trips: number };
  series: SeriesPoint[];
}

export interface RangeStats {
  solar: ChannelStats | null;
  fuelCell: ChannelStats | null;
  vehicle: ChannelStats | null;
  battery: ChannelStats | null;
  energy: EnergyTotals;
  soc: { min: number; max: number; avg: number; start: number; end: number };
  thermal: { min: number; max: number; avg: number };
  peakPowerW: number;
  avgPowerW: number;
}

/** Firmware health flags surfaced on the Device and System Status panels. */
export interface NodeHealthFlags {
  wifi: boolean | null;
  sd: boolean | null;
  cloud: boolean | null;
  uptimeS: number | null;
}

export interface TimeRange {
  key: string;
  label: string;
  from: number;
  to: number;
  bucketMs: number;
}

/** Uniform JSON envelope returned by every `/api` route (`ok()` helper). */
export interface ApiEnvelope<T> {
  ok: boolean;
  envelope: DataEnvelope<T>;
  range?: TimeRange;
}

export interface ApiError {
  ok: false;
  error: string;
  retryAfter?: number;
}

/* -------------------------------------------------------------------------- */
/* Page payloads (mirror the shapes returned by lib/data.ts)                  */
/* -------------------------------------------------------------------------- */

export interface SystemEventRecord {
  id: string;
  timestamp: string;
  type: string;
  severity: string;
  message: string;
  detail?: string;
}

export interface HardwareSnapshot {
  firmware: string;
  ip: string | null;
  rssi: number | null;
  uptimeS: number | null;
  freeHeapBytes: number | null;
  sdFreeMb: number | null;
  mqttTopic: string | null;
  battery: BatteryState | null;
  /** Wi-Fi / SD / cloud flags straight from the last telemetry frame. */
  node: NodeHealthFlags;
}

export interface ChannelBundleStats {
  solar: ChannelStats | null;
  fuelCell: ChannelStats | null;
  vehicle: ChannelStats | null;
  battery: ChannelStats | null;
}

export interface LivePayload {
  latest: TelemetryReading | null;
  battery: BatteryState | null;
  points: SeriesPoint[];
  link: LinkState;
  stats: ChannelBundleStats;
}

export interface BatteryPayload {
  latest: TelemetryReading | null;
  battery: BatteryState | null;
  points: SeriesPoint[];
  stats: ChannelStats;
  soc: { min: number; max: number; avg: number; start: number; end: number };
  thermal: { min: number; max: number; avg: number };
}

export interface ChannelPayload {
  latest: TelemetryReading | null;
  points: SeriesPoint[];
  buckets: EnergyBucket[];
  stats: ChannelStats;
  totals: EnergyTotals;
  contribution: number;
  share: number;
  consumKwh: number;
  soc: { min: number; max: number; avg: number };
}

export interface EnergyPayload {
  latest: TelemetryReading | null;
  points: SeriesPoint[];
  buckets: EnergyBucket[];
  totals: EnergyTotals;
  shares: { solar: number; fuelCell: number; batteryShare: number; consumption: number };
  flow: { solar: number; fuelCell: number; vehicle: number; battery: number };
}

export interface AiEdgeSummary {
  mcu: string;
  runtime: string;
  modelsActive: number;
  inferenceMs: number | null;
  horizonS: number;
  samplesEvaluated: number;
  health: AiModelState;
}

export interface AiPayload {
  latest: TelemetryReading | null;
  models: AiModelReport[];
  timeline: AiTimelineEvent[];
  points: SeriesPoint[];
  edge: AiEdgeSummary;
}

export interface TripsTotals {
  distanceKm: number;
  energyKwh: number;
  solarKwh: number;
  fuelCellKwh: number;
  regenKwh: number;
  socDrop: number;
}

export interface TripsPayload {
  trips: TripRecord[];
  totals: TripsTotals;
}

export interface AnalyticsPayload {
  points: SeriesPoint[];
  buckets: EnergyBucket[];
  stats: RangeStats;
  latest: TelemetryReading | null;
}

export interface AlertsPayload {
  alerts: AlertRecord[];
  summary: { total: number; critical: number; warning: number; info: number; active: number };
}

/** Paginated raw-frame view used by the Data page. */
export interface TelemetryTablePayload {
  deviceId: string;
  rows: TelemetryReading[];
  total: number;
  page: number;
  pages: number;
}

export interface DevicePayload {
  device: DeviceInfo;
  hardware: HardwareSnapshot;
  events: SystemEventRecord[];
}

/** Client-safe mirror of the fleet rows produced by `getFleet()`. */
export interface FleetRow {
  deviceId: string;
  name: string;
  source: DataSource;
  status: 'online' | 'delayed' | 'offline' | 'unknown';
  location: string;
  lastSeen: string | null;
}

export interface DatabaseHealth {
  ok: boolean;
  configured: boolean;
  latencyMs: number | null;
  collections?: Record<string, number> | null;
  error?: string | null;
  checkedAt: string;
}
