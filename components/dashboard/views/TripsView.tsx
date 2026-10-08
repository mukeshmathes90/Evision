'use client';

import { ArrowRight, BatteryCharging, Download, Fuel, Route as RouteIcon, Timer, TrendingDown, Zap } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { THRESHOLDS } from '@/lib/constants';
import { EM, fmt, fmtDateTime, fmtDuration, toneClass } from '@/lib/format';
import type { ApiEnvelope, TimeRange, TripRecord, TripsPayload, TripsTotals } from '@/types';

function durationS(t: TripRecord) {
  const start = Date.parse(t.startTime);
  const end = t.endTime ? Date.parse(t.endTime) : Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / 1000));
}

function efficiencyTone(record: TripRecord) {
  if (record.distanceKm <= 0 || !Number.isFinite(record.efficiencyKwhPerKm)) return 'neutral' as const;
  if (record.efficiencyKwhPerKm * 1000 <= THRESHOLDS.consumption.efficient) return 'hydro' as const;
  if (record.efficiencyKwhPerKm * 1000 <= THRESHOLDS.consumption.warn) return 'volt' as const;
  return 'warn' as const;
}

function EfficiencyBar({ record }: { record: TripRecord }) {
  const whPerKm = record.distanceKm > 0 ? record.efficiencyKwhPerKm * 1000 : null;
  const max = THRESHOLDS.consumption.warn * 1.5;
  const pct = whPerKm != null && Number.isFinite(whPerKm) ? Math.min(100, (whPerKm / max) * 100) : 0;
  return (
    <span className="flex min-w-[132px] items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-hydro-400 to-cyan-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-mono text-[11.5px] tabular-nums text-ink-200">{fmt(whPerKm, 1)}</span>
    </span>
  );
}

function TotalsGrid({ totals, count }: { totals: TripsTotals; count: number }) {
  const avgEfficiency = totals.distanceKm > 0 ? (totals.energyKwh / totals.distanceKm) * 1000 : null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="Trips" value={String(count)} tone="volt" />
      <StatTile label="Distance" value={fmt(totals.distanceKm, 2)} unit="km" tone="ion" />
      <StatTile label="Pack energy" value={fmt(totals.energyKwh, 3)} unit="kWh" tone="hydro" />
      <StatTile label="Solar used" value={fmt(totals.solarKwh, 3)} unit="kWh" tone="sun" />
      <StatTile label="Stack used" value={fmt(totals.fuelCellKwh, 3)} unit="kWh" tone="ion" />
      <StatTile label="Fleet average" value={fmt(avgEfficiency, 1)} unit="Wh/km" tone="warn" />
    </div>
  );
}

export function TripsView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<TripsPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const url = `/api/trips?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<TripsPayload>> url={url} initial={initial} intervalMs={30000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const trips = p?.trips ?? [];
        const totals = p?.totals;
        const longest = trips.reduce((a, t) => Math.max(a, t.distanceKm), 0);
        const bestEfficiency = trips.reduce(
          (a, t) => (a && a.efficiencyKwhPerKm <= t.efficiencyKwhPerKm ? a : t),
          trips[0] ?? null,
        );
        const avgEfficiency =
          totals && totals.distanceKm > 0 ? (totals.energyKwh / totals.distanceKm) * 1000 : null;

        return (
          <>
            <PageHeader
              eyebrow="Mobility log"
              title="Trips"
              description="Journeys reconstructed from telemetry: distance and duration integrated from the traction channel, energy drawn from pack counters, and the AI model's SOC estimate recorded at both ends of each trip."
              icon={RouteIcon}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={
                <>
                  <DateRangeSelector defaultKey={range.key} />
                  <a
                    href={`/api/trips?device=${encodeURIComponent(deviceId)}&range=${range.key}${
                      range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
                    }&format=csv`}
                    className="btn-secondary !px-3 !py-2 !text-[11px]"
                    download
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </a>
                </>
              }
            />

            <div className="space-y-4">
              <MetricGrid cols={4}>
                <MetricCard
                  label="Trips recorded"
                  value={trips.length ? String(trips.length) : EM}
                  icon={RouteIcon}
                  tone="volt"
                  hint={env?.lastSeen ? `Latest frame ${fmtDateTime(env.lastSeen)}` : 'No frames in window'}
                />
                <MetricCard
                  label="Distance covered"
                  value={fmt(totals?.distanceKm ?? null, 2)}
                  unit="km"
                  icon={RouteIcon}
                  tone="ion"
                  progress={
                    totals && Number.isFinite(totals.distanceKm)
                      ? Math.min(100, (totals.distanceKm / Math.max(1, longest * 3)) * 100)
                      : null
                  }
                  hint={`Longest single trip ${fmt(longest, 2)} km`}
                  index={1}
                />
                <MetricCard
                  label="Energy used"
                  value={fmt(totals?.energyKwh ?? null, 3)}
                  unit="kWh"
                  icon={Zap}
                  tone="hydro"
                  hint={`${fmt(avgEfficiency, 1)} Wh/km across the window`}
                  index={2}
                />
                <MetricCard
                  label="SOC consumed"
                  value={fmt(totals?.socDrop ?? null, 1)}
                  unit="%"
                  icon={TrendingDown}
                  tone="warn"
                  compact
                  hint={`Regenerated ${fmt(totals?.regenKwh ?? null, 3)} kWh`}
                  index={3}
                />
              </MetricGrid>

              {!trips.length || !totals ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetryâ€¦"
                      description={
                        env?.empty ?? 'No trips could be reconstructed from the traction channel inside this window.'
                      }
                      state={env?.link ?? 'unknown'}
                      action={<DateRangeSelector defaultKey={range.key} />}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <Panel>
                <PanelHeader
                  title="Journey log"
                  subtitle={`${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} reconstructed from channel 0x03`}
                  icon={RouteIcon}
                />
                <PanelBody>
                  <div className="space-y-2">
                    {trips.map((t) => {
                      const dur = durationS(t);
                      const tone = efficiencyTone(t);
                      return (
                        <Link
                          key={t.id}
                          href={`/dashboard/trips/${t.id}?device=${encodeURIComponent(deviceId)}`}
                          className="group panel-inset block px-4 py-3.5 transition-colors hover:border-white/[0.16]"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-ink-300 transition-colors group-hover:text-cyan-300">
                                <RouteIcon className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-[13px] font-medium text-ink-50">
                                  {fmtDateTime(t.startTime)}
                                  {!t.endTime ? <span className="ml-2 text-[11px] text-hydro-300">ongoing</span> : null}
                                </p>
                                <p className="mt-0.5 font-mono text-[10.5px] text-ink-500">
                                  {fmtDateTime(t.startTime)} â†’ {t.endTime ? fmtDateTime(t.endTime) : 'in progress'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                              <span className="flex items-center gap-1.5">
                                <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-600">Dist</span>
                                <span className="font-mono text-[12px] tabular-nums text-ink-100">{fmt(t.distanceKm, 2)} km</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-600">Dur</span>
                                <span className="font-mono text-[12px] tabular-nums text-ink-100">
                                  {dur != null ? fmtDuration(dur) : EM}
                                </span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-600">SOC</span>
                                <span className="font-mono text-[12px] tabular-nums text-ink-100">
                                  {fmt(t.startSoc, 0)} â†’ {fmt(t.endSoc, 0)} %
                                </span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-600">Energy</span>
                                <span className="font-mono text-[12px] tabular-nums text-ink-100">{fmt(t.energyKwh, 3)} kWh</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-600">Wh/km</span>
                                <span className={`font-mono text-[12px] tabular-nums ${toneClass(tone)}`}>
                                  <EfficiencyBar record={t} />
                                </span>
                              </span>
                              <ArrowRight className="h-4 w-4 text-ink-600 transition-colors group-hover:text-cyan-300" />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Window ledger"
                  subtitle="Aggregated across every reconstructed journey"
                  icon={BatteryCharging}
                />
                <PanelBody>
                  {totals ? <TotalsGrid totals={totals} count={trips.length} /> : null}
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <StatTile label="Stack contribution" value={fmt(totals?.fuelCellKwh ?? null, 3)} unit="kWh" tone="ion" />
                    <StatTile label="Solar contribution" value={fmt(totals?.solarKwh ?? null, 3)} unit="kWh" tone="sun" />
                    <StatTile label="Best trip" value={fmt(bestEfficiency?.efficiencyKwhPerKm ?? null, 3)} unit="kWh/km" tone="hydro" />
                  </div>
                  <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-500">
                    <Fuel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-600" />
                    A journey closes after {fmtDuration(THRESHOLDS.trip.gapSeconds)} without motion and must exceed{' '}
                    {THRESHOLDS.trip.minDistanceKm} km at an average of {THRESHOLDS.trip.minSpeedKph} km/h. Everything
                    shown is integrated on the server from PZEM-017 channel 0x03 â€” no external positioning service is involved.
                  </p>
                </PanelBody>
              </Panel>

              <p className="flex items-center gap-2 px-1 text-[11px] text-ink-600">
                <Timer className="h-3.5 w-3.5" />
                Open any journey to inspect its frame-by-frame trace, AI annotations and energy split.
              </p>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}