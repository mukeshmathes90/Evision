'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BrainCircuit,
  Flame,
  Gauge,
  GaugeCircle,
  Route,
  Sun,
  Thermometer,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { PowerChart, SOCChart, TemperatureChart } from '@/components/charts/Charts';
import { EnergyFlow, EnergyFlowLegend } from '@/components/vehicle/EnergyFlow';

import { VehicleTelemetryStrip } from '@/components/vehicle/VehicleComponentPanel';
import { AI_TONE, THRESHOLDS } from '@/lib/constants';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit, thermalColor } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ApiEnvelope, OverviewPayload, TimeRange } from '@/types';

export function OverviewView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<OverviewPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const url = `/api/dashboard?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<OverviewPayload>> url={url} initial={initial} intervalMs={5000} showIndicator>
      {(res, meta) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const socs = (p?.series ?? []).map((s) => s.soc).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        const battery = p?.battery ?? null;
        const latest = p?.latest ?? null;
        const noData = !latest;

        return (
          <>
            <PageHeader
              eyebrow="Command centre"
              title="Mission control"
              description="Everything the vehicle reported in this window â€” sources, pack, traction bus, thermal envelope and edge AI â€” derived server-side from the telemetry collection."
              icon={Gauge}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={
                <>
                  <DateRangeSelector defaultKey={range.key} />
                  <button type="button" onClick={meta.refresh} className="btn-secondary !px-3 !py-2 !text-[11px]">
                    Refresh
                  </button>
                </>
              }
            />

            <div className="space-y-4">
              <MetricGrid cols={4}>
                <MetricCard
                  label="State of charge"
                  value={fmt(p?.ai.soc ?? null, 1)}
                  unit="%"
                  icon={BatteryCharging}
                  tone="volt"
                  progress={p?.ai.soc ?? null}
                  hint={`Reserve warning at ${THRESHOLDS.socLow} % Â· intervention at ${THRESHOLDS.socCritical} %`}
                  index={0}
                />
                <MetricCard
                  label="Predicted range"
                  value={fmt(p?.ai.range ?? null, 1)}
                  unit="km"
                  icon={GaugeCircle}
                  tone="ion"
                  hint="AI-MODEL-02 Â· horizon 180 s"
                  index={1}
                />
                <MetricCard
                  label="Pack net power"
                  value={battery ? fmtPower(battery.netPowerW) : EM}
                  unit={battery ? fmtPowerUnit(battery.netPowerW) : ''}
                  icon={Zap}
                  tone={battery?.mode === 'charging' ? 'hydro' : battery?.mode === 'discharging' ? 'warn' : 'neutral'}
                  hint={battery ? `Mode ${battery.mode.toUpperCase()} Â· health ${fmt(battery.healthPct, 1)} %` : 'Awaiting frame'}
                  index={2}
                />
                <MetricCard
                  label="Thermal peak"
                  value={fmt(p?.thermal.max ?? null, 1)}
                  unit="Â°C"
                  icon={Thermometer}
                  tone={(p?.thermal.max ?? 0) >= THRESHOLDS.thermal.high ? 'danger' : 'ion'}
                  progress={p?.thermal.max != null ? Math.min(100, (p?.thermal.max ?? 0) / THRESHOLDS.thermal.critical) * 100 : null}
                  hint={`High limit ${THRESHOLDS.thermal.high} Â°C Â· critical ${THRESHOLDS.thermal.critical} Â°C`}
                  index={3}
                />
              </MetricGrid>

              <MetricGrid cols={4}>
                <MetricCard
                  label="Solar generation"
                  value={latest ? fmtPower(absOrNull(latest.solar.power)) : EM}
                  unit={latest ? fmtPowerUnit(latest.solar.power) : ''}
                  icon={Sun}
                  tone="sun"
                  compact
                  hint={`${fmt(p?.stats.solar?.energyDelta ?? null, 3)} kWh in window`}
                  index={4}
                />
                <MetricCard
                  label="Fuel-cell output"
                  value={latest ? fmtPower(absOrNull(latest.fuelCell.power)) : EM}
                  unit={latest ? fmtPowerUnit(latest.fuelCell.power) : ''}
                  icon={Flame}
                  tone="ion"
                  compact
                  hint={`${fmt(p?.stats.fuelCell?.energyDelta ?? null, 3)} kWh in window`}
                  index={5}
                />
                <MetricCard
                  label="Traction load"
                  value={latest ? fmtPower(absOrNull(latest.vehicle.power)) : EM}
                  unit={latest ? fmtPowerUnit(latest.vehicle.power) : ''}
                  icon={Activity}
                  tone="volt"
                  compact
                  hint={`Peak ${fmt((p?.stats.vehicle?.powerPeak ?? Number.NaN) / 1000, 2)} kW in window`}
                  index={6}
                />
                <MetricCard
                  label="Anomaly score"
                  value={fmt(p?.ai.anomalyScore ?? null, 3)}
                  icon={BrainCircuit}
                  tone={p?.ai.state === 'anomaly' ? 'danger' : p?.ai.state === 'warning' ? 'warn' : 'hydro'}
                  compact
                  hint={`${AI_TONE[p?.ai.state ?? 'normal'].label} Â· threshold ${THRESHOLDS.anomaly.warning.toFixed(2)}`}
                  index={7}
                />
              </MetricGrid>

              {noData ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetryâ€¦"
                      description={
                        env?.empty ??
                        `No telemetry documents for ${env?.deviceId ?? deviceId} inside this window. The edge node writes straight into MongoDB Atlas; values appear as soon as the next frame lands.`
                      }
                      state={env?.link ?? 'unknown'}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-8">
                  <PanelHeader
                    title="Power envelope"
                    subtitle="Solar, fuel cell, pack net and traction load"
                    icon={Activity}
                    action={
                      <Link href="/dashboard/energy" className="text-[11px] text-ink-400 hover:text-ink-100">
                        Energy detail â†’
                      </Link>
                    }
                  />
                  <PanelBody>
                    <PowerChart points={p?.series ?? []} from={range.from} to={range.to} height={280} />
                  </PanelBody>
                </Panel>

                <Panel className="xl:col-span-4">
                  <PanelHeader title="Charge trajectory" icon={BatteryCharging} />
                  <PanelBody>
                    <div className="grid grid-cols-2 gap-2">
                      <StatTile label="Window low" value={fmt(socs.length ? Math.min(...socs) : null, 1)} unit="%" tone="ion" />
                      <StatTile label="Window high" value={fmt(socs.length ? Math.max(...socs) : null, 1)} unit="%" tone="hydro" />
                    </div>
                    <div className="mt-4">
                      <SOCChart points={p?.series ?? []} from={range.from} to={range.to} height={200} />
                    </div>
                    <VehicleTelemetryStrip latest={latest} />
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-7">
                  <PanelHeader
                    title="Energy routing"
                    subtitle="Live flow between array, stack, pack and motor"
                    icon={Zap}
                    action={
                      <Link href="/dashboard/energy" className="text-[11px] text-ink-400 hover:text-ink-100">
                        Full analysis â†’
                      </Link>
                    }
                  />
                  <PanelBody>
                    <EnergyFlow latest={latest} battery={battery} orientation="horizontal" />
                    <div className="mt-5">
                      <EnergyFlowLegend />
                    </div>
                  </PanelBody>
                </Panel>

                <Panel className="xl:col-span-5">
                  <PanelHeader
                    title="Thermal envelope"
                    icon={Thermometer}
                    action={
                      <Link href="/dashboard/thermal" className="text-[11px] text-ink-400 hover:text-ink-100">
                        Probe map â†’
                      </Link>
                    }
                  />
                  <PanelBody>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(['t1', 't2', 't3', 't4'] as const).map((k) => {
                        const v = latest?.temperature[k];
                        return (
                          <div key={k} className="panel-inset px-3 py-2.5">
                            <div className="flex items-center justify-between">
                              <span className="micro">{k.toUpperCase()}</span>
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: v != null ? thermalColor(v) : '#37425A' }}
                              />
                            </div>
                            <p className="mt-1.5 font-mono text-[16px] tabular-nums text-ink-50">{fmt(v)}</p>
                            <p className="text-[9.5px] text-ink-600">Â°C</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4">
                      <TemperatureChart points={p?.series ?? []} from={range.from} to={range.to} height={190} />
                    </div>
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-7">
                  <PanelHeader
                    title="Latest alerts"
                    icon={TriangleAlert}
                    action={
                      <Link href="/dashboard/alerts" className="text-[11px] text-ink-400 hover:text-ink-100">
                        Alert centre â†’
                      </Link>
                    }
                  />
                  <PanelBody dense>
                    {p?.counts.alerts ? (
                      <div className="space-y-2">
                        <p className="px-1 text-[11.5px] text-ink-400">
                          {p.counts.alerts} alert{p.counts.alerts === 1 ? '' : 's'} raised in this window.{' '}
                          {p.counts.trips} trip{p.counts.trips === 1 ? '' : 's'} recorded.
                        </p>
                      </div>
                    ) : (
                      <EmptyState
                        title="No alerts in this window"
                        description="All seven engineering rules evaluated every frame without crossing a threshold."
                        state="online"
                        compact
                        action={
                          <Link href="/dashboard/alerts" className="btn-secondary">
                            Open alert centre
                          </Link>
                        }
                      />
                    )}
                  </PanelBody>
                </Panel>

                <Panel className="xl:col-span-5">
                  <PanelHeader title="Window summary" icon={Route} />
                  <PanelBody>
                    <SectionLabel>Energy ledger</SectionLabel>
                    <div className="mt-4 space-y-3">
                      {[
                        { label: 'Solar generated', value: p?.energy.solarKwh, color: '#FBBF24' },
                        { label: 'Fuel-cell generated', value: p?.energy.fuelCellKwh, color: '#22D3EE' },
                        { label: 'Traction consumed', value: p?.energy.vehicleKwh, color: '#60A5FA' },
                        { label: 'Pack throughput', value: p?.energy.batteryKwh, color: '#A78BFA' },
                        { label: 'Net position', value: p?.energy.netKwh, color: '#34D399' },
                        { label: 'Regenerative recovery', value: p?.energy.regenerativeKwh, color: '#34D399' },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between border-b border-white/[0.05] pb-2.5 last:border-0">
                          <span className="inline-flex items-center gap-2 text-[12px] text-ink-400">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                            {r.label}
                          </span>
                          <span className="font-mono text-[12px] tabular-nums text-ink-100">
                            {fmt(r.value ?? null, 3)} <span className="text-ink-500">kWh</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className={cn('mt-4 text-[11px] leading-relaxed text-ink-500')}>
                      Frames aggregated: <span className="font-mono text-ink-200">{p?.counts.telemetry.toLocaleString('en-US')}</span>{' '}
                      Â· link <span className="font-mono text-ink-200">{env?.link}</span>
                    </p>
                  </PanelBody>
                </Panel>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
                <p className="text-[11.5px] text-ink-500">
                  {env?.lastSeen ? `Last frame ${env.lastSeen.replace('T', ' ').slice(0, 19)} UTC` : 'No frame received yet'}
                  {env?.source === 'demo' ? ' Â· demo dataset' : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/dashboard/live" className="btn-primary !px-3.5 !py-2 !text-[11.5px]">
                    Live view
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link href="/dashboard/analytics" className="btn-secondary !px-3.5 !py-2 !text-[11.5px]">
                    Analytics
                  </Link>
                </div>
              </div>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}