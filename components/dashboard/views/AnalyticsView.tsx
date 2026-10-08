'use client';

import { Activity, BarChart3, Download, Gauge, LineChart, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { CurrentChart, EnergyBucketChart, PowerChart, TemperatureChart, VoltageChart } from '@/components/charts/Charts';
import { THRESHOLDS } from '@/lib/constants';
import { EM, fmt } from '@/lib/format';
import type { AnalyticsPayload, ApiEnvelope, ChannelStats, TimeRange } from '@/types';

function ChannelStatsTable({ rows }: { rows: { label: string; stats: ChannelStats | null }[] }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-white/[0.07]">
            {['Channel', 'Samples', 'Mean V', 'Peak V', 'Mean A', 'Peak A', 'Mean W', 'Peak W', 'Energy'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-white/[0.04]">
              <td className="px-3 py-2.5 text-[12px] text-ink-200">{r.label}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-300">{r.stats?.samples ?? EM}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-300">{fmt(r.stats?.voltageAvg ?? null, 1)}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-300">{fmt(r.stats?.voltagePeak ?? null, 1)}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-300">{fmt(r.stats?.currentAvg ?? null, 2)}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-300">{fmt(r.stats?.currentPeak ?? null, 2)}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-300">{fmt(r.stats?.powerAvg ?? null, 1)}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-300">{fmt(r.stats?.powerPeak ?? null, 1)}</td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-100">{fmt(r.stats?.energyDelta ?? null, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyticsView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<AnalyticsPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const url = `/api/analytics?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<AnalyticsPayload>> url={url} initial={initial} intervalMs={20000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const stats = p?.stats;
        const hasData = (p?.points.length ?? 0) > 0;

        return (
          <>
            <PageHeader
              eyebrow="Longitudinal review"
              title="Analytics"
              description="Server-side aggregation over the selected window: per-channel statistics, bucketed energy, charge band and thermal envelope for the whole vehicle."
              icon={LineChart}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={
                <>
                  <DateRangeSelector defaultKey={range.key} />
                  <a
                    href={`/api/telemetry?device=${encodeURIComponent(deviceId)}&range=${range.key}&format=csv`}
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
                  label="Peak traction power"
                  value={fmt(stats ? stats.peakPowerW / 1000 : null, 2)}
                  unit="kW"
                  icon={TrendingUp}
                  tone="volt"
                  progress={stats ? Math.min(100, (stats.peakPowerW / THRESHOLDS.vehiclePowerHigh) * 100) : null}
                  hint={`Ceiling ${(THRESHOLDS.vehiclePowerHigh / 1000).toFixed(1)} kW continuous`}
                />
                <MetricCard
                  label="Mean traction power"
                  value={fmt(stats ? stats.avgPowerW / 1000 : null, 2)}
                  unit="kW"
                  icon={Gauge}
                  tone="ion"
                  hint={`Active ${fmt(stats?.vehicle?.activeRatio != null ? stats.vehicle.activeRatio * 100 : null, 0)} % of frames`}
                  index={1}
                />
                <MetricCard
                  label="Energy moved"
                  value={fmt(stats?.energy.netKwh ?? null, 2)}
                  unit="kWh"
                  icon={BarChart3}
                  tone="hydro"
                  hint={`${fmt(stats?.energy.solarKwh ?? null, 2)} kWh solar · ${fmt(stats?.energy.fuelCellKwh ?? null, 2)} kWh stack`}
                  index={2}
                />
                <MetricCard
                  label="Charge band"
                  value={fmt(stats?.soc.avg ?? null, 1)}
                  unit="%"
                  icon={Activity}
                  tone="warn"
                  progress={stats?.soc.avg ?? null}
                  hint={`${fmt(stats?.soc.min ?? null, 1)} – ${fmt(stats?.soc.max ?? null, 1)} % across window`}
                  index={3}
                />
              </MetricGrid>

              {!hasData ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetry…"
                      description={env?.empty ?? 'No telemetry documents exist inside this window, so no aggregates are displayed.'}
                      state={env?.link ?? 'unknown'}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <Panel>
                <PanelHeader title="Power by bucket" subtitle={`${p?.buckets.length ?? 0} buckets over the window`} />
                <PanelBody>
                  <EnergyBucketChart buckets={p?.buckets ?? []} height={300} />
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader title="Channel statistics" subtitle="Aggregated server-side from raw documents" />
                <PanelBody>
                  <ChannelStatsTable
                    rows={[
                      { label: 'Solar (0x01)', stats: stats?.solar ?? null },
                      { label: 'Fuel cell (0x02)', stats: stats?.fuelCell ?? null },
                      { label: 'Vehicle / pack (0x03)', stats: stats?.vehicle ?? null },
                      { label: 'Pack derived', stats: stats?.battery ?? null },
                    ]}
                  />
                </PanelBody>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="Power" />
                  <PanelBody>
                    <PowerChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Voltage" />
                  <PanelBody>
                    <VoltageChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Current" />
                  <PanelBody>
                    <CurrentChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Temperature" />
                  <PanelBody>
                    <TemperatureChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
              </div>

              <Panel>
                <PanelHeader title="Window aggregates" subtitle="Derived values used across the platform" />
                <PanelBody>
                  <SectionLabel>Charge and thermal</SectionLabel>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <StatTile label="SOC start" value={fmt(stats?.soc.start ?? null, 1)} unit="%" tone="volt" />
                    <StatTile label="SOC end" value={fmt(stats?.soc.end ?? null, 1)} unit="%" tone="volt" />
                    <StatTile label="SOC mean" value={fmt(stats?.soc.avg ?? null, 1)} unit="%" tone="ion" />
                    <StatTile label="Thermal min" value={fmt(stats?.thermal.min ?? null, 1)} unit="°C" tone="hydro" />
                    <StatTile label="Thermal mean" value={fmt(stats?.thermal.avg ?? null, 1)} unit="°C" tone="warn" />
                    <StatTile label="Thermal max" value={fmt(stats?.thermal.max ?? null, 1)} unit="°C" tone="danger" />
                  </div>
                  <SectionLabel className="mt-6">Energy ledger</SectionLabel>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <StatTile label="Solar" value={fmt(stats?.energy.solarKwh ?? null, 3)} unit="kWh" tone="sun" />
                    <StatTile label="Fuel cell" value={fmt(stats?.energy.fuelCellKwh ?? null, 3)} unit="kWh" tone="ion" />
                    <StatTile label="Pack" value={fmt(stats?.energy.batteryKwh ?? null, 3)} unit="kWh" tone="volt" />
                    <StatTile label="Traction" value={fmt(stats?.energy.vehicleKwh ?? null, 3)} unit="kWh" tone="warn" />
                    <StatTile label="Net" value={fmt(stats?.energy.netKwh ?? null, 3)} unit="kWh" tone="hydro" />
                    <StatTile label="Regen" value={fmt(stats?.energy.regenerativeKwh ?? null, 3)} unit="kWh" tone="hydro" />
                  </div>
                </PanelBody>
              </Panel>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}