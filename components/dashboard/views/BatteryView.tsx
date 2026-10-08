'use client';

import { BatteryCharging, CircleGauge, HeartPulse, Repeat, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { LinearGauge, PowerGauge, SOCGauge } from '@/components/charts/Gauges';
import { PowerChart, SOCChart, VoltageChart } from '@/components/charts/Charts';
import { THRESHOLDS } from '@/lib/constants';
import { absOrNull, EM, fmt, fmtDuration, fmtPower, fmtPowerUnit } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ApiEnvelope, BatteryPayload, TimeRange } from '@/types';

export function BatteryView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<BatteryPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const url = `/api/battery?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<BatteryPayload>> url={url} initial={initial} intervalMs={5000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const b = p?.battery ?? null;
        const latest = p?.latest ?? null;

        return (
          <>
            <PageHeader
              eyebrow="Energy storage"
              title="Battery intelligence"
              description="State of charge from AI-MODEL-01, pack throughput measured on PZEM #3, cell-level context and the thermal state of the enclosure."
              icon={BatteryCharging}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={<DateRangeSelector defaultKey={range.key} />}
            />

            <div className="space-y-4">
              <MetricGrid cols={4}>
                <MetricCard
                  label="State of charge"
                  value={fmt(p?.soc.end ?? null, 1)}
                  unit="%"
                  icon={BatteryCharging}
                  tone="volt"
                  progress={p?.soc.end ?? null}
                  hint={`Window ${fmt(p?.soc.min ?? null, 1)} â€“ ${fmt(p?.soc.max ?? null, 1)} % Â· mean ${fmt(p?.soc.avg ?? null, 1)} %`}
                />
                <MetricCard
                  label="Pack net power"
                  value={b ? fmtPower(b.netPowerW) : EM}
                  unit={b ? fmtPowerUnit(b.netPowerW) : ''}
                  icon={Zap}
                  tone={b?.mode === 'charging' ? 'hydro' : b?.mode === 'discharging' ? 'warn' : 'neutral'}
                  hint={b ? `Mode ${b.mode.toUpperCase()}` : 'Awaiting frame'}
                  index={1}
                />
                <MetricCard
                  label="Pack health"
                  value={fmt(b?.healthPct ?? null, 1)}
                  unit="%"
                  icon={HeartPulse}
                  tone="hydro"
                  progress={b?.healthPct ?? null}
                  hint={b ? `Condition ${b.condition} Â· ${b.cycles.toLocaleString('en-US')} cycles` : 'Awaiting frame'}
                  index={2}
                />
                <MetricCard
                  label="Cell voltage"
                  value={fmt(b?.cellVoltage ?? null, 3)}
                  unit="V"
                  icon={CircleGauge}
                  tone="ion"
                  hint={
                    b
                      ? `${b.cellCount} cells in series Â· pack ${fmt(latest?.vehicle.voltage ?? null, 1)} V`
                      : 'Awaiting frame'
                  }
                  index={3}
                />
              </MetricGrid>

              {!b ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetryâ€¦"
                      description={env?.empty ?? 'No battery state could be derived because no telemetry document exists for this window.'}
                      state={env?.link ?? 'unknown'}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-4">
                  <PanelHeader title="Charge" subtitle="AI-MODEL-01" icon={BatteryCharging} />
                  <PanelBody>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <SOCGauge value={b?.soc ?? null} size={200} />
                      <PowerGauge value={latest?.vehicle.power ?? null} size={168} />
                    </div>
                    <div className="mt-4 space-y-3">
                      <LinearGauge
                        value={latest?.vehicle.voltage ?? null}
                        max={THRESHOLDS.batteryVoltageHigh}
                        label="Pack voltage"
                        unit="V"
                        tone="volt"
                        thresholds={[THRESHOLDS.batteryVoltageLow, THRESHOLDS.batteryVoltageNominal, THRESHOLDS.batteryVoltageHigh]}
                        hint={`Nominal ${THRESHOLDS.batteryVoltageNominal} V Â· low ${THRESHOLDS.batteryVoltageLow} V Â· high ${THRESHOLDS.batteryVoltageHigh} V`}
                      />
                      <LinearGauge
                        value={latest ? absOrNull(latest.vehicle.current) : null}
                        max={THRESHOLDS.vehicleCurrentHigh}
                        label="Pack current"
                        unit="A"
                        tone="ion"
                        thresholds={[30, 45, THRESHOLDS.vehicleCurrentHigh]}
                        hint={`Contactor ceiling ${THRESHOLDS.vehicleCurrentHigh} A`}
                      />
                      <LinearGauge
                        value={p?.thermal.max ?? null}
                        max={THRESHOLDS.thermal.critical}
                        label="Enclosure peak"
                        unit="Â°C"
                        tone={p && p.thermal.max >= THRESHOLDS.thermal.high ? 'danger' : 'hydro'}
                        thresholds={[THRESHOLDS.thermal.warm, THRESHOLDS.thermal.high, THRESHOLDS.thermal.critical]}
                        hint={`Warm ${THRESHOLDS.thermal.warm} Â°C Â· high ${THRESHOLDS.thermal.high} Â°C Â· critical ${THRESHOLDS.thermal.critical} Â°C`}
                      />
                    </div>
                  </PanelBody>
                </Panel>

                <Panel className="xl:col-span-8">
                  <PanelHeader title="State-of-charge trajectory" subtitle="Prediction against measured bus voltage" icon={Repeat} />
                  <PanelBody>
                    <SOCChart points={p?.points ?? []} from={range.from} to={range.to} height={260} />
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <StatTile label="Window low" value={fmt(p?.soc.min ?? null, 1)} unit="%" tone="ion" />
                      <StatTile label="Window high" value={fmt(p?.soc.max ?? null, 1)} unit="%" tone="hydro" />
                      <StatTile label="Window mean" value={fmt(p?.soc.avg ?? null, 1)} unit="%" tone="volt" />
                      <StatTile
                        label="Net change"
                        value={p && Number.isFinite(p.soc.end - p.soc.start) ? `${(p.soc.end - p.soc.start).toFixed(1)}` : EM}
                        unit="%"
                        tone={p && p.soc.end - p.soc.start < 0 ? 'warn' : 'hydro'}
                      />
                    </div>
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="Pack throughput" subtitle="Net power and traction load" />
                  <PanelBody>
                    <PowerChart points={p?.points ?? []} from={range.from} to={range.to} height={240} showBattery />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Bus voltage" subtitle="Pack and channel voltages" />
                  <PanelBody>
                    <VoltageChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
              </div>

              <Panel>
                <PanelHeader title="Degradation ledger" subtitle="Longitudinal battery context" />
                <PanelBody>
                  <SectionLabel>Life-cycle indicators</SectionLabel>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                      label="Equivalent cycles"
                      value={b ? b.cycles.toLocaleString('en-US') : EM}
                      hint="Counted on the edge node"
                      tone="volt"
                    />
                    <StatTile label="Cell count" value={b ? b.cellCount : EM} unit="series" hint="13S pack topology" tone="ion" />
                    <StatTile
                      label="State of health"
                      value={fmt(b?.healthPct ?? null, 1)}
                      unit="%"
                      hint={b ? `Rated condition: ${b.condition}` : 'Awaiting frame'}
                      tone="hydro"
                    />
                    <StatTile
                      label="Uptime reported"
                      value={env?.lastSeen ? fmtDuration((Date.now() - Date.parse(env.lastSeen)) / 1000) + ' since frame' : EM}
                      hint="Time since the newest document"
                      tone="neutral"
                    />
                  </div>
                  <p className={cn('mt-4 text-[11px] leading-relaxed text-ink-500')}>
                    Reserve warning is raised at {THRESHOLDS.socLow} % and the low-SOC critical threshold sits at{' '}
                    {THRESHOLDS.socCritical} %. Bus collapse below {THRESHOLDS.batteryVoltageLow} V raises an
                    abnormal-voltage alert.
                  </p>
                </PanelBody>
              </Panel>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}