'use client';

import { BatteryCharging, Download, Flame, PieChart, Sun, TrendingUp, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { CurrentChart, EnergyBucketChart, NetEnergyChart, PowerChart, VoltageChart } from '@/components/charts/Charts';
import { EnergyFlow, EnergyFlowLegend } from '@/components/vehicle/EnergyFlow';
import { THRESHOLDS } from '@/lib/constants';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit } from '@/lib/format';
import type { ApiEnvelope, EnergyPayload, TimeRange } from '@/types';

export function EnergyView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<EnergyPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const url = `/api/energy?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<EnergyPayload>> url={url} initial={initial} intervalMs={5000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const latest = p?.latest ?? null;
        const totals = p?.totals;
        const hasBuckets = (p?.buckets.length ?? 0) > 0;

        return (
          <>
            <PageHeader
              eyebrow="Energy intelligence"
              title="Energy flow"
              description="Channel-level accounting of every watt-hour moved through the photovoltaic array, the hydrogen stack, the 48 V pack and the traction bus."
              icon={Zap}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={
                <>
                  <DateRangeSelector defaultKey={range.key} />
                  <a
                    href={`/api/energy?device=${encodeURIComponent(deviceId)}&range=${range.key}&format=csv`}
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
                  label="Solar generated"
                  value={fmt(totals?.solarKwh ?? null, 2)}
                  unit="kWh"
                  icon={Sun}
                  tone="sun"
                  progress={p?.shares.solar ?? null}
                  hint={`${fmt(p?.shares.solar ?? null, 1)} % of generation in window`}
                />
                <MetricCard
                  label="Fuel-cell generated"
                  value={fmt(totals?.fuelCellKwh ?? null, 2)}
                  unit="kWh"
                  icon={Flame}
                  tone="ion"
                  progress={p?.shares.fuelCell ?? null}
                  hint={`${fmt(p?.shares.fuelCell ?? null, 1)} % of generation in window`}
                  index={1}
                />
                <MetricCard
                  label="Traction consumed"
                  value={fmt(totals?.vehicleKwh ?? null, 2)}
                  unit="kWh"
                  icon={TrendingUp}
                  tone="volt"
                  progress={p?.shares.consumption ?? null}
                  hint={`${fmt(p?.shares.consumption ?? null, 1)} % against generation`}
                  index={2}
                />
                <MetricCard
                  label="Net position"
                  value={fmt(totals?.netKwh ?? null, 2)}
                  unit="kWh"
                  icon={PieChart}
                  tone={(totals?.netKwh ?? 0) < 0 ? 'warn' : 'hydro'}
                  hint={`${fmt(totals?.regenerativeKwh ?? null, 2)} kWh recovered by regeneration`}
                  index={3}
                />
              </MetricGrid>

              {!hasBuckets ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetryâ€¦"
                      description={env?.empty ?? 'No energy buckets could be derived for this window, so no accounting figures are shown.'}
                      state={env?.link ?? 'unknown'}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <Panel>
                <PanelHeader title="Live routing" subtitle="Sources into the pack, pack into traction" icon={Zap} />
                <PanelBody>
                  <EnergyFlow latest={latest} battery={null} orientation="vertical" />
                  <div className="mt-6">
                    <EnergyFlowLegend />
                  </div>
                </PanelBody>
              </Panel>

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-7">
                  <PanelHeader title="Generation and consumption by bucket" subtitle={hasBuckets ? `${p?.buckets.length} buckets` : 'No buckets'} />
                  <PanelBody>
                    <EnergyBucketChart buckets={p?.buckets ?? []} height={300} />
                  </PanelBody>
                </Panel>
                <Panel className="xl:col-span-5">
                  <PanelHeader title="Net position" subtitle="Generation minus consumption" />
                  <PanelBody>
                    <NetEnergyChart buckets={(p?.buckets ?? []).map((b) => ({ label: b.label, netKwh: b.netKwh }))} height={300} />
                    <div className="mt-4 space-y-2.5">
                      {[
                        { label: 'Pack throughput', value: totals?.batteryKwh, color: '#A78BFA', icon: BatteryCharging },
                        { label: 'Regenerative recovery', value: totals?.regenerativeKwh, color: '#34D399', icon: TrendingUp },
                        { label: 'Solar share', value: p?.shares.solar, color: '#FBBF24', icon: Sun, pct: true },
                        { label: 'Stack share', value: p?.shares.fuelCell, color: '#22D3EE', icon: Flame, pct: true },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between border-b border-white/[0.05] pb-2 last:border-0">
                          <span className="inline-flex items-center gap-2 text-[12px] text-ink-400">
                            <r.icon className="h-3.5 w-3.5" style={{ color: r.color }} />
                            {r.label}
                          </span>
                          <span className="font-mono text-[12px] tabular-nums text-ink-100">
                            {fmt(r.value ?? null, r.pct ? 1 : 3)}
                            <span className="text-ink-500">{r.pct ? ' %' : ' kWh'}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="Power" subtitle="Live channels" />
                  <PanelBody>
                    <PowerChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Current" subtitle="Direction of each channel" />
                  <PanelBody>
                    <CurrentChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Voltage" subtitle="Array, stack and bus" />
                  <PanelBody>
                    <VoltageChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Ratios" subtitle="Derived efficiency context" />
                  <PanelBody>
                    <SectionLabel>Window aggregates</SectionLabel>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <StatTile
                        label="Array vs rated"
                        value={latest?.solar.power != null ? fmt(((absOrNull(latest.solar.power) as number) / THRESHOLDS.solarPowerNominal) * 100, 1) : EM}
                        unit="%"
                        tone="sun"
                      />
                      <StatTile
                        label="Stack vs rated"
                        value={latest?.fuelCell.power != null ? fmt(((absOrNull(latest.fuelCell.power) as number) / THRESHOLDS.fuelCellPowerNominal) * 100, 1) : EM}
                        unit="%"
                        tone="ion"
                      />
                      <StatTile
                        label="Pack share"
                        value={fmt(p?.shares.batteryShare ?? null, 1)}
                        unit="%"
                        tone="volt"
                      />
                      <StatTile
                        label="Source power now"
                        value={
                          latest?.solar.power != null && latest?.fuelCell.power != null
                            ? fmtPower(absOrNull(latest.solar.power) as number + (absOrNull(latest.fuelCell.power) as number))
                            : EM
                        }
                        unit={latest ? fmtPowerUnit(latest.solar.power) : ''}
                        tone="hydro"
                      />
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                      A negative net position means the pack met demand that generation did not cover; a positive position means
                      the sources produced a surplus that the pack absorbed or the traction bus returned.
                    </p>
                  </PanelBody>
                </Panel>
              </div>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}