'use client';

import { Snowflake, Thermometer, ThermometerSun } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { TemperatureChart } from '@/components/charts/Charts';
import { ThermalMap } from '@/components/vehicle/ThermalMap';
import { THERMAL_TONE, THRESHOLDS } from '@/lib/constants';
import { EM, fmt, thermalColor } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ApiEnvelope, ThermalReport, TimeRange } from '@/types';

export function ThermalView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<ThermalReport>;
  deviceId: string;
  range: TimeRange;
}) {
  const url = `/api/thermal?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<ThermalReport>> url={url} initial={initial} intervalMs={8000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const report = env?.data ?? null;
        const tone = THERMAL_TONE[report?.status ?? 'normal'];
        const hasData = !!report?.map?.length;

        return (
          <>
            <PageHeader
              eyebrow="Thermal management"
              title="Thermal envelope"
              description="Four DS18B20 probes mapped onto the vehicle — photovoltaic roof, fuel-cell stack, traction inverter and battery enclosure — evaluated against derating limits."
              icon={Thermometer}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={<DateRangeSelector defaultKey={range.key} />}
            />

            <div className="space-y-4">
              <MetricGrid cols={4}>
                <MetricCard
                  label="Warmest probe"
                  value={fmt(report?.max ?? null, 1)}
                  unit="°C"
                  icon={ThermometerSun}
                  tone={report?.status === 'critical' ? 'danger' : report?.status === 'high' ? 'warn' : 'ion'}
                  progress={report?.max != null ? Math.min(100, (report.max / THRESHOLDS.thermal.critical) * 100) : null}
                  hint={`High limit ${THRESHOLDS.thermal.high} °C · critical ${THRESHOLDS.thermal.critical} °C`}
                />
                <MetricCard
                  label="Coolest probe"
                  value={fmt(report?.min ?? null, 1)}
                  unit="°C"
                  icon={Snowflake}
                  tone="volt"
                  progress={report?.min != null ? Math.min(100, (report.min / THRESHOLDS.thermal.critical) * 100) : null}
                  hint="Lower bound across the window"
                  index={1}
                />
                <MetricCard
                  label="Mean temperature"
                  value={fmt(report?.avg ?? null, 1)}
                  unit="°C"
                  icon={Thermometer}
                  tone="neutral"
                  hint="Average across sampled frames"
                  index={2}
                />
                <MetricCard
                  label="Thermal spread"
                  value={fmt(report?.delta ?? null, 1)}
                  unit="°C"
                  icon={Thermometer}
                  tone={(report?.delta ?? 0) > 25 ? 'warn' : 'hydro'}
                  compact
                  hint="Difference between warmest and coolest zone"
                  index={3}
                />
              </MetricGrid>

              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
                <span className={cn('chip', tone.text, tone.ring)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', tone.bar.split(' ')[1])} />
                  Status {tone.label}
                </span>
                <span className="text-[11.5px] text-ink-400">
                  Warm at {THRESHOLDS.thermal.warm} °C · high at {THRESHOLDS.thermal.high} °C · derate at{' '}
                  {THRESHOLDS.thermal.critical} °C.
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-7">
                  <PanelHeader title="Thermal map" subtitle="Top-down projection tinted by probe temperature" icon={Thermometer} />
                  <PanelBody>
                    {hasData ? (
                      <ThermalMap cells={report?.map ?? []} status={report?.status ?? 'normal'} />
                    ) : (
                      <EmptyState
                        title="Waiting for telemetry…"
                        description={env?.empty ?? 'No thermal readings exist for this device in the selected window.'}
                        state={env?.link ?? 'unknown'}
                      />
                    )}
                  </PanelBody>
                </Panel>

                <Panel className="xl:col-span-5">
                  <PanelHeader title="Probe matrix" subtitle="Zone assignments and live values" />
                  <PanelBody>
                    <div className="space-y-2.5">
                      {(report?.sensors ?? []).map((s) => (
                        <div key={s.key} className="panel-inset px-3.5 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium text-ink-100">{s.label}</span>
                            <span className="font-mono text-[15px] tabular-nums text-ink-50">
                              {fmt(s.value)} <span className="text-[10px] text-ink-500">°C</span>
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-[10.5px] text-ink-500">{s.zone}</span>
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${s.value == null ? 0 : Math.min(100, Math.max(0, ((s.value - 15) / (THRESHOLDS.thermal.critical - 15)) * 100))}%`,
                                  background: thermalColor(s.value),
                                }}
                              />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5">
                      <p className="micro-strong">Limits</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(report?.limits ?? []).map((l) => (
                          <StatTile key={l.label} label={l.label} value={l.value} unit="°C" tone="neutral" />
                        ))}
                      </div>
                    </div>
                  </PanelBody>
                </Panel>
              </div>

              <Panel>
                <PanelHeader title="Temperature history" subtitle="Four probes against the high-temperature limit" icon={Thermometer} />
                <PanelBody>
                  <TemperatureChart points={report?.series ?? []} from={range.from} to={range.to} height={300} withMax={false} />
                  <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                    Readings above {THRESHOLDS.thermal.high} °C raise a high-temperature alert at critical severity. Window
                    extremes: {fmt(report?.min ?? null, 1)} °C to {fmt(report?.max ?? null, 1)} °C
                    {report && Number.isFinite(report.delta) ? ` · spread ${fmt(report.delta, 1)} °C` : ''}.
                  </p>
                </PanelBody>
              </Panel>

              <p className="px-1 text-[11px] text-ink-600">
                Latest frame {env?.lastSeen ? env.lastSeen.replace('T', ' ').slice(0, 19) : EM} UTC
              </p>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}