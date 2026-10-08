import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowRight, BatteryCharging, Flame, Gauge, Route, Sun, Thermometer, Zap } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Reveal } from '@/components/marketing/Reveal';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { DataSourceBadge, EmptyState, Value } from '@/components/ui/EmptyState';
import { activeDeviceId, getAnalytics, getTrips } from '@/lib/data';
import { resolveRange } from '@/lib/time-range';
import { EM, fmt, fmtDuration } from '@/lib/format';
import { PRODUCT, THRESHOLDS } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Performance · ${PRODUCT.name}`,
  description:
    'Seven-day performance review computed live from the telemetry collection: peak and mean traction power, source contribution, regeneration, efficiency, SOC band and thermal envelope.',
  alternates: { canonical: '/performance' },
};

function Metric({
  label,
  value,
  unit,
  hint,
  accent = '#E7EDF8',
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="panel p-5">
      <p className="micro">{label}</p>
      <p className="mt-3 font-mono text-[26px] leading-none tabular-nums" style={{ color: accent }}>
        <Value value={value} />
        {value !== EM && unit ? <span className="ml-1 text-[11px] text-ink-500">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">{hint}</p> : null}
    </div>
  );
}

export default async function PerformancePage() {
  const deviceId = activeDeviceId();
  const range = resolveRange('7d');
  const [analytics, trips] = await Promise.all([getAnalytics(deviceId, range), getTrips(deviceId, range)]);

  const stats = analytics.data.stats;
  const energy = stats.energy;
  const totals = trips.data.totals;
  const hasData = analytics.data.points.length > 0;

  const generation = (energy.solarKwh ?? 0) + (energy.fuelCellKwh ?? 0);
  const solarShare = generation > 0 ? ((energy.solarKwh ?? 0) / generation) * 100 : Number.NaN;
  const fcShare = generation > 0 ? ((energy.fuelCellKwh ?? 0) / generation) * 100 : Number.NaN;
  const effKm = totals.distanceKm > 0 ? totals.energyKwh / totals.distanceKm : Number.NaN;
  const regenRatio = totals.energyKwh > 0 ? (totals.regenKwh / totals.energyKwh) * 100 : Number.NaN;
  const loadRatio = stats.vehicle?.samples ? (stats.vehicle.activeRatio ?? Number.NaN) * 100 : Number.NaN;

  const thermalCeiling = THRESHOLDS.thermal.high;

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <PublicNav />
      <main className="pt-16">
        <section className="relative">
          <div
            className="pointer-events-none absolute inset-0 grid-fine bg-grid"
            style={{ maskImage: 'radial-gradient(110% 70% at 50% 0%, black, transparent)', WebkitMaskImage: 'radial-gradient(110% 70% at 50% 0%, black, transparent)' }}
          />
          <div className="relative mx-auto max-w-[1400px] px-5 pb-12 pt-16 lg:px-8 lg:pt-24">
            <Reveal>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="micro-strong">Performance review</span>
                <DataSourceBadge source={analytics.source} />
                <span className="chip">7 day window</span>
              </div>
              <h1 className="mt-5 max-w-3xl text-[34px] leading-[1.05] sm:text-[46px]">
                What the last seven days actually looked like
              </h1>
              <p className="mt-6 max-w-2xl text-[13.5px] leading-relaxed text-ink-300">
                Every figure on this page is aggregated from the <span className="font-mono">telemetry</span> collection for{' '}
                <span className="font-mono text-ink-100">{analytics.deviceId}</span> over the window
                {' '}
                {fmtDateTime(new Date(range.from).toISOString())} → {fmtDateTime(new Date(range.to).toISOString())}.
                {analytics.source === 'demo' ? ' This window is served from the labelled demo dataset.' : ''}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/dashboard/analytics" className="btn-primary">
                  Open analytics
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/dashboard/reports" className="btn-secondary">
                  Generate a report
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {!hasData ? (
          <section className="border-t border-white/[0.06] py-10">
            <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
              <Panel>
                <PanelHeader title="No telemetry in window" icon={Activity} />
                <PanelBody>
                  <EmptyState
                    title="Waiting for telemetry…"
                    description={
                      analytics.empty ??
                      'The aggregation returned no documents for this device in the selected window, so no performance figures are shown.'
                    }
                    state={analytics.link}
                  />
                </PanelBody>
              </Panel>
            </div>
          </section>
        ) : (
          <>
            <section className="border-t border-white/[0.06] py-14">
              <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Peak traction power"
                    value={fmt(stats.peakPowerW / 1000, 2)}
                    unit="kW"
                    hint={`Continuous design ceiling ${(THRESHOLDS.vehiclePowerHigh / 1000).toFixed(1)} kW`}
                    accent="#60A5FA"
                  />
                  <Metric
                    label="Mean traction power"
                    value={fmt(stats.avgPowerW / 1000, 2)}
                    unit="kW"
                    hint={`Active ${fmt(loadRatio, 0)} % of sampled frames`}
                    accent="#A78BFA"
                  />
                  <Metric
                    label="Distance travelled"
                    value={fmt(totals.distanceKm, 1)}
                    unit="km"
                    hint={`${totals.distanceKm > 0 ? 'Across' : 'No'} ${trips.data.trips.length} recorded trips`}
                    accent="#34D399"
                  />
                  <Metric
                    label="Consumption"
                    value={fmt(effKm, 3)}
                    unit="kWh/km"
                    hint={Number.isFinite(effKm) ? 'Energy used per kilometre' : 'Requires at least one recorded trip'}
                    accent="#FBBF24"
                  />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Energy drawn"
                    value={fmt(totals.energyKwh, 2)}
                    unit="kWh"
                    hint="Across recorded trips in the window"
                    accent="#F87171"
                  />
                  <Metric
                    label="Regenerative recovery"
                    value={fmt(totals.regenKwh, 2)}
                    unit="kWh"
                    hint={`${fmt(regenRatio, 1)} % of trip energy returned to the pack`}
                    accent="#34D399"
                  />
                  <Metric
                    label="Solar contribution"
                    value={fmt(solarShare, 1)}
                    unit="%"
                    hint={`${fmt(energy.solarKwh, 2)} kWh generated on the roof array`}
                    accent="#FBBF24"
                  />
                  <Metric
                    label="Fuel-cell contribution"
                    value={fmt(fcShare, 1)}
                    unit="%"
                    hint={`${fmt(energy.fuelCellKwh, 2)} kWh from the hydrogen stack`}
                    accent="#22D3EE"
                  />
                </div>
              </div>
            </section>

            <section className="border-t border-white/[0.06] py-14 lg:py-18">
              <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
                <div className="grid gap-4 lg:grid-cols-3">
                  <Panel>
                    <PanelHeader title="Source mix" subtitle="Share of generation in window" icon={Zap} />
                    <PanelBody>
                      <div className="space-y-4">
                        {[
                          { label: 'Solar array', value: energy.solarKwh, share: solarShare, color: '#FBBF24', icon: Sun },
                          { label: 'Fuel cell', value: energy.fuelCellKwh, share: fcShare, color: '#22D3EE', icon: Flame },
                          { label: 'Battery pack', value: energy.batteryKwh, share: Number.NaN, color: '#A78BFA', icon: BatteryCharging },
                          { label: 'Traction bus', value: energy.vehicleKwh, share: Number.NaN, color: '#60A5FA', icon: Activity },
                        ].map((s) => (
                          <div key={s.label}>
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className="inline-flex items-center gap-2 text-ink-300">
                                <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                                {s.label}
                              </span>
                              <span className="font-mono tabular-nums text-ink-100">{fmt(s.value, 2)} kWh</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Number.isFinite(s.share) ? Math.min(100, s.share) : 0}%`,
                                  background: s.color,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-5 text-[11px] leading-relaxed text-ink-500">
                        Net position over the window: <Value value={`${fmt(energy.netKwh, 3)} kWh`} />. A negative value means the pack
                        absorbed more than the sources delivered.
                      </p>
                    </PanelBody>
                  </Panel>

                  <Panel>
                    <PanelHeader title="Charge band" subtitle="AI state-of-charge trajectory" icon={Gauge} />
                    <PanelBody>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['Window low', `${fmt(stats.soc.min, 1)} %`],
                          ['Window high', `${fmt(stats.soc.max, 1)} %`],
                          ['Window mean', `${fmt(stats.soc.avg, 1)} %`],
                          ['Trajectory', `${fmt(stats.soc.end - stats.soc.start, 1)} %`],
                        ].map(([l, v]) => (
                          <div key={l} className="panel-inset px-3 py-2.5">
                            <p className="micro">{l}</p>
                            <p className="mt-1.5 font-mono text-[15px] tabular-nums text-ink-50">{v}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                        Reserve warning at {THRESHOLDS.socLow} % and intervention floor at {THRESHOLDS.socCritical} %. A trajectory
                        below zero means the pack discharged across the window.
                      </p>
                    </PanelBody>
                  </Panel>

                  <Panel>
                    <PanelHeader title="Thermal envelope" subtitle="Probe extremes in window" icon={Thermometer} />
                    <PanelBody>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['Coolest', `${fmt(stats.thermal.min, 1)} °C`],
                          ['Warmest', `${fmt(stats.thermal.max, 1)} °C`],
                          ['Mean', `${fmt(stats.thermal.avg, 1)} °C`],
                          ['Excursion', `${fmt(stats.thermal.max - thermalCeiling, 1)} °C`],
                        ].map(([l, v]) => (
                          <div key={l} className="panel-inset px-3 py-2.5">
                            <p className="micro">{l}</p>
                            <p className="mt-1.5 font-mono text-[15px] tabular-nums text-ink-50">{v}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                        The excursion column reports the margin against the {THRESHOLDS.thermal.high} °C high-temperature limit;
                        negative values indicate headroom remained.
                      </p>
                    </PanelBody>
                  </Panel>
                </div>
              </div>
            </section>

            <section className="border-t border-white/[0.06] py-14">
              <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
                <Reveal>
                  <div className="panel p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="chip">Read next</span>
                        <h2 className="mt-4 text-[22px] leading-tight lg:text-[28px]">Verify the review against raw frames</h2>
                        <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-ink-400">
                          This summary is an aggregation. The data-history view exposes the underlying documents, and the energy view
                          shows the same window bucketed by hour so the totals can be reconciled.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/dashboard/data" className="btn-secondary">
                          <Route className="h-3.5 w-3.5" />
                          Data history
                        </Link>
                        <Link href="/dashboard/energy" className="btn-primary">
                          Energy flow
                        </Link>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3 text-[11.5px] text-ink-500">
                      <span>Device {analytics.deviceLabel}</span>
                      <span>Link {analytics.link}</span>
                      <span>Last seen {analytics.lastSeen ? fmtDuration((Date.now() - Date.parse(analytics.lastSeen)) / 1000) + ' ago' : EM}</span>
                      <span>{analytics.data.points.length} points aggregated</span>
                    </div>
                  </div>
                </Reveal>
              </div>
            </section>
          </>
        )}

        <section className="border-t border-white/[0.06] py-12">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="flex flex-wrap gap-2">
              {['Peak power', 'Efficiency', 'Regeneration', 'Source mix', 'Charge band', 'Thermal envelope'].map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}