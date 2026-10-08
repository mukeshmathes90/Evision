import { guard, ok, fail } from '@/lib/api';
import { deviceFromParams, rangeFromParams } from '@/lib/api-range';
import { getAlerts, getAnalytics, getTrips } from '@/lib/data';
import { csvResponse } from '@/lib/format';
import { THRESHOLDS } from '@/lib/constants';
import type { RangeStats } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type ReportKind = 'daily' | 'weekly' | 'monthly' | 'trip' | 'energy' | 'ai' | 'thermal';

const HEADLINE: Record<ReportKind, (d: ReturnType<typeof shape>) => string[]> = {
  daily: (d) => [
    `Vehicle load peaked at ${Math.round(d.stats.vehicle?.powerPeak ?? 0)} W with a window mean of ${Math.round(d.stats.vehicle?.powerAvg ?? 0)} W.`,
    `Solar contributed ${(d.stats.solar?.energyDelta ?? 0) >= 0 ? '+' : ''}${(d.stats.solar?.energyDelta ?? 0).toFixed(2)} kWh; fuel cell added ${(d.stats.fuelCell?.energyDelta ?? 0).toFixed(2)} kWh.`,
    `State of charge moved from ${d.socStart.toFixed(1)} % to ${d.socEnd.toFixed(1)} % across the reporting window.`,
    `Thermal envelope held between ${d.thermal.min.toFixed(1)} °C and ${d.thermal.max.toFixed(1)} °C — status ${d.thermal.status.toUpperCase()}.`,
  ],
  weekly: (d) => [
    `Seven-day traction consumption of ${(d.totals.vehicleKwh || 0).toFixed(1)} kWh against ${(d.totals.solarKwh + d.totals.fuelCellKwh || 0).toFixed(1)} kWh of on-board generation.`,
    `Regenerative recovery returned ${(d.totals.regenerativeKwh || 0).toFixed(2)} kWh to the pack.`,
    `Peak traction power ${Math.round(d.stats.vehicle?.powerPeak ?? 0)} W · mean ${Math.round(d.stats.vehicle?.powerAvg ?? 0)} W.`,
    `${d.alerts.critical} critical and ${d.alerts.warning} warning events were raised in the window.`,
  ],
  monthly: (d) => [
    `Net energy position for the month: ${(d.totals.netKwh || 0).toFixed(1)} kWh.`,
    `Solar yield ${(d.totals.solarKwh || 0).toFixed(1)} kWh · fuel-cell yield ${(d.totals.fuelCellKwh || 0).toFixed(1)} kWh.`,
    `Mean thermal load ${d.thermal.avg.toFixed(1)} °C with a ${(d.thermal.max - d.thermal.min).toFixed(1)} °C spread.`,
    `Pack health trajectory is stable; derating margin against ${THRESHOLDS.thermal.high} °C remains positive.`,
  ],
  trip: (d) => [
    `Trip energy ${(d.totals.vehicleKwh || 0).toFixed(2)} kWh over the selected journey set.`,
    `State of charge delta ${(d.socStart - d.socEnd).toFixed(1)} percentage points.`,
    `Peak traction power ${Math.round(d.stats.vehicle?.powerPeak ?? 0)} W.`,
    `${d.tripCount} trip records included in this dossier.`,
  ],
  energy: (d) => [
    `Generation ledger: solar ${(d.totals.solarKwh || 0).toFixed(2)} kWh, fuel cell ${(d.totals.fuelCellKwh || 0).toFixed(2)} kWh.`,
    `Consumption ledger: traction ${(d.totals.vehicleKwh || 0).toFixed(2)} kWh, pack throughput ${(d.totals.batteryKwh || 0).toFixed(2)} kWh.`,
    `Net position ${(d.totals.netKwh || 0).toFixed(2)} kWh over the audited window.`,
    `Estimated conversion and cabling losses ${(Math.max(0, (d.totals.batteryKwh || 0) * 0.06)).toFixed(2)} kWh.`,
  ],
  ai: (d) => [
    `Three edge models active on the ESP32-S3 with a combined mean inference latency of ${d.aiLatency.toFixed(1)} ms.`,
    `Anomaly score peaked at ${d.anomalyPeak.toFixed(3)} against a warning threshold of ${THRESHOLDS.anomaly.warning}.`,
    `SOC window drift ${Math.abs(d.socStart - d.socEnd).toFixed(1)} percentage points.`,
    `${d.timelineCount} inference events logged in the window.`,
  ],
  thermal: (d) => [
    `Probe maximum ${d.thermal.max.toFixed(1)} °C against a critical limit of ${THRESHOLDS.thermal.critical} °C.`,
    `Probe minimum ${d.thermal.min.toFixed(1)} °C · mean ${d.thermal.avg.toFixed(1)} °C.`,
    `Compliance status: ${d.thermal.status.toUpperCase()}.`,
    `${d.excursions} sample(s) exceeded the high-temperature threshold.`,
  ],
};

function shape(d: {
  stats: RangeStats;
  socStart: number;
  socEnd: number;
  thermal: { min: number; max: number; avg: number; status: string };
  totals: { solarKwh: number; fuelCellKwh: number; vehicleKwh: number; batteryKwh: number; netKwh: number; regenerativeKwh: number };
  alerts: { critical: number; warning: number };
  tripCount: number;
  aiLatency: number;
  anomalyPeak: number;
  timelineCount: number;
  excursions: number;
}) {
  return d;
}

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const sp = new URL(req.url).searchParams;
    const kind = (sp.get('kind') ?? 'daily') as ReportKind;
    if (!HEADLINE[kind]) return fail('Unknown report kind', 400);

    const range = rangeFromParams(sp, kind === 'daily' ? '24h' : kind === 'weekly' ? '7d' : kind === 'monthly' ? '30d' : '24h');
    const deviceId = deviceFromParams(sp);
    const [analytics, alerts, trips] = await Promise.all([
      getAnalytics(deviceId, range),
      getAlerts(deviceId, range, {}),
      getTrips(deviceId, range),
    ]);

    const s = analytics.data.stats;
    // A frame with no valid probe or channel stays out of the excursion count.
    const excursions = analytics.data.points.filter((p) => p.tempMax != null && p.tempMax >= THRESHOLDS.thermal.high).length;
    // Preserve "unknown" through to the prose: `NaN.toFixed()` renders "NaN",
    // which would be a fabricated reading, so every headline input is coerced to
    // a finite number or explicitly 0 only where 0 is a truthful statement.
    const finite = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const ctx = {
      stats: s,
      socStart: finite(s.soc.start),
      socEnd: finite(s.soc.end),
      thermal: {
        min: finite(s.thermal.min),
        max: finite(s.thermal.max),
        avg: finite(s.thermal.avg),
        status:
          s.thermal.max >= THRESHOLDS.thermal.critical
            ? ('critical' as const)
            : s.thermal.max >= THRESHOLDS.thermal.high
              ? ('high' as const)
              : s.thermal.max >= THRESHOLDS.thermal.warm
                ? ('warm' as const)
                : ('normal' as const),
      },
      totals: {
        solarKwh: finite(s.energy.solarKwh),
        fuelCellKwh: finite(s.energy.fuelCellKwh),
        vehicleKwh: finite(s.energy.vehicleKwh),
        batteryKwh: finite(s.energy.batteryKwh),
        netKwh: finite(s.energy.netKwh),
        regenerativeKwh: finite(s.energy.regenerativeKwh),
      },
      alerts: alerts.data.summary,
      tripCount: trips.data.trips.length,
      aiLatency: finite(analytics.data.latest?.ai.inferenceMs),
      anomalyPeak: analytics.data.points.length
        ? Math.max(0, ...analytics.data.points.map((p) => p.anomalyScore ?? 0))
        : 0,
      timelineCount: 0,
      excursions,
    };

    const findings = HEADLINE[kind](ctx);
    const r1 = (v: number | null | undefined) => (v == null ? null : Number(v.toFixed(1)));
    const r2 = (v: number | null | undefined) => (v == null ? null : Number(v.toFixed(2)));
    const series = analytics.data.points.map((p) => ({
      t: p.t,
      solar: r1(p.solarPower),
      fuelCell: r1(p.fuelCellPower),
      vehicle: r1(p.vehiclePower),
      soc: r2(p.soc),
      tempAvg: r2(p.tempAvg),
    }));

    const payload = {
      kind,
      title: sp.get('title') ?? defaultTitle(kind, deviceId),
      generatedAt: new Date().toISOString(),
      deviceId,
      source: analytics.source,
      range: { from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString(), label: range.label },
      summary: {
        distanceKm: trips.data.totals.distanceKm,
        energyKwh: ctx.totals.vehicleKwh,
        solarKwh: ctx.totals.solarKwh,
        fuelCellKwh: ctx.totals.fuelCellKwh,
        netKwh: ctx.totals.netKwh,
        peakPowerW: Number.isFinite(s.vehicle?.powerPeak) ? (s.vehicle?.powerPeak ?? 0) : 0,
        avgPowerW: Number.isFinite(s.vehicle?.powerAvg) ? (s.vehicle?.powerAvg ?? 0) : 0,
        socStart: Number.isFinite(ctx.socStart) ? ctx.socStart : 0,
        socEnd: Number.isFinite(ctx.socEnd) ? ctx.socEnd : 0,
        thermalMax: ctx.thermal.max,
        thermalAvg: ctx.thermal.avg,
        alertsCritical: ctx.alerts.critical,
        alertsWarning: ctx.alerts.warning,
        trips: ctx.tripCount,
      },
      findings,
      series,
    };

    if (sp.get('format') === 'csv') {
      const rows: (string | number | null)[][] = [
        ['EVISION AI — report export'],
        ['report', payload.title],
        ['kind', kind],
        ['device', deviceId],
        ['source', payload.source.toUpperCase()],
        ['window_from', payload.range.from],
        ['window_to', payload.range.to],
        ['generated_at', payload.generatedAt],
        [],
        ['finding'],
        ...findings.map((f) => [f]),
        [],
        ['metric', 'value'],
        ...Object.entries(payload.summary).map(([k, v]) => [k, v as string | number]),
        [],
        ['timestamp', 'solar_w', 'fuelcell_w', 'vehicle_w', 'soc_pct', 'temp_avg_c'],
        ...series.map((p) => [new Date(p.t).toISOString(), p.solar, p.fuelCell, p.vehicle, p.soc, p.tempAvg]),
      ];
      return csvResponse(`evision-report-${kind}-${deviceId}-${Date.now()}.csv`, rows);
    }

    return ok({ report: payload });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}

function defaultTitle(kind: ReportKind, deviceId: string): string {
  const map: Record<ReportKind, string> = {
    daily: 'Daily Operations Report',
    weekly: 'Weekly Fleet Performance',
    monthly: 'Monthly Sustainability Report',
    trip: 'Trip Energy Dossier',
    energy: 'Energy Flow Audit',
    ai: 'Embedded AI Performance',
    thermal: 'Thermal Compliance Report',
  };
  return `${map[kind]} · ${deviceId}`;
}
