import { buildSeries, seriesToPoints } from './synthetic';
import { normaliseReading } from './format';
import type { TelemetryReading } from '@/types';

/** Drop `null`/NaN entries so aggregates only see probes that reported. */
function seriesToNumbers(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

export interface DemoTableQuery {
  deviceId: string;
  from: number;
  to: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  search?: string;
}

/**
 * Serves the telemetry history table from the deterministic demo dataset using
 * the exact same sort / paginate / search semantics as the MongoDB query.
 */
export function demoTelemetryRows(q: DemoTableQuery) {
  const rows: TelemetryReading[] = seriesToPoints(buildSeries(q.deviceId, q.from, q.to, 400)).map((p) => {
    const battery = {
      soc: p.soc,
      mode: ((p.batteryPower ?? 0) > 8 ? 'charging' : (p.batteryPower ?? 0) < -8 ? 'discharging' : 'idle') as
        | 'charging'
        | 'discharging'
        | 'idle',
      netPowerW: p.batteryPower,
      condition: 'excellent' as const,
      healthPct: 96.4,
      cycles: 412,
      cellVoltage: p.voltage == null ? null : p.voltage / 13,
      cellCount: 13,
    };
    const probes = seriesToNumbers([p.t1, p.t2, p.t3, p.t4]);
    return normaliseReading({
      deviceId: q.deviceId,
      timestamp: new Date(p.t).toISOString(),
      solar: { voltage: p.solarVoltage, current: p.solarCurrent, power: p.solarPower, energy: p.energy.solarKwh },
      fuelCell: { voltage: p.fuelCellVoltage, current: p.fuelCellCurrent, power: p.fuelCellPower, energy: p.energy.fuelCellKwh },
      vehicle: { voltage: p.vehicleVoltage, current: p.vehicleCurrent, power: p.vehiclePower, energy: p.energy.vehicleKwh },
      temperature: {
        t1: p.t1,
        t2: p.t2,
        t3: p.t3,
        t4: p.t4,
        min: probes.length ? Math.min(...probes) : null,
        max: probes.length ? Math.max(...probes) : null,
        avg: p.tempAvg,
      },
      ai: { soc: p.soc, range: p.range, anomalyScore: p.anomalyScore, inferenceMs: 5.4, horizonS: 180, modelsActive: 7 },
      battery,
      meta: { firmware: 'evision-edge-1.4.2', rssi: -58, uptimeS: 3_628_800 },
    });
  });

  // Sorting mirrors MongoDB's behaviour for missing values: they are grouped at
  // the end rather than being treated as 0.
  const accessor: Record<string, (r: TelemetryReading) => number | string | null> = {
    timestamp: (r) => Date.parse(r.timestamp),
    soc: (r) => r.ai.soc,
    power: (r) => r.vehicle.power,
    voltage: (r) => r.vehicle.voltage,
    current: (r) => r.vehicle.current,
    range: (r) => r.ai.range,
    t1: (r) => r.temperature.t1,
    t2: (r) => r.temperature.t2,
    t3: (r) => r.temperature.t3,
    t4: (r) => r.temperature.t4,
  };
  const get = accessor[q.sortBy] ?? accessor.timestamp;
  const dir = q.sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
    return (av - bv) * dir;
  });

  let filtered = rows;
  if (q.search) {
    const asNum = Number(q.search);
    if (Number.isFinite(asNum) && q.search.trim() !== '') {
      filtered = rows.filter((r) => r.ai.soc != null && Math.abs(r.ai.soc - asNum) <= 0.75);
    } else {
      const s = q.search.toLowerCase();
      filtered = rows.filter((r) => r.deviceId.toLowerCase().includes(s));
    }
  }

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / q.pageSize));
  const page = Math.min(q.page, pages);
  const skip = (page - 1) * q.pageSize;
  return { rows: filtered.slice(skip, skip + q.pageSize), total, page, pages };
}
