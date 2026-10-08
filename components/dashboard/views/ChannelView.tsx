'use client';

import { Download, Flame, Gauge, Sun, TrendingUp, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { CurrentChart, EnergyBucketChart, PowerChart, VoltageChart } from '@/components/charts/Charts';
import { LinearGauge, PowerGauge } from '@/components/charts/Gauges';
import { THRESHOLDS } from '@/lib/constants';
import { absOrNull, EM, fmt } from '@/lib/format';
import type { ApiEnvelope, ChannelPayload, TimeRange } from '@/types';

const CONFIG = {
  solar: {
    eyebrow: 'Photovoltaic',
    title: 'Solar array',
    description:
      'Roof-mounted array metered by PZEM-017 at Modbus address 0x01. Tracks instantaneous output, cumulative yield and the share of total generation it contributes.',
    icon: Sun,
    tone: 'sun' as const,
    color: '#FBBF24',
    rated: THRESHOLDS.solarPowerNominal,
    ratedLabel: '2.0 kWp array',
    probe: 'T1 Â· PV roof',
    address: '0x01',
  },
  fuelCell: {
    eyebrow: 'Hydrogen',
    title: 'Fuel cell',
    description:
      'PEM stack metered by PZEM-017 at Modbus address 0x02. Follows stack ramp, output against the 1.5 kW rated envelope and cumulative hydrogen conversion.',
    icon: Flame,
    tone: 'ion' as const,
    color: '#22D3EE',
    rated: THRESHOLDS.fuelCellPowerNominal,
    ratedLabel: '1.5 kW stack',
    probe: 'T2 Â· stack & humidifier',
    address: '0x02',
  },
} as const;

export function ChannelView({
  channel,
  initial,
  deviceId,
  range,
}: {
  channel: 'solar' | 'fuelCell';
  initial: ApiEnvelope<ChannelPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const cfg = CONFIG[channel];
  const url = `/api/${channel === 'solar' ? 'solar' : 'fuel-cell'}?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<ChannelPayload>> url={url} initial={initial} intervalMs={5000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const latest = p?.latest ?? null;
        const reading = latest ? (channel === 'solar' ? latest.solar : latest.fuelCell) : null;
        const temp = latest ? (channel === 'solar' ? latest.temperature.t1 : latest.temperature.t2) : null;

        return (
          <>
            <PageHeader
              eyebrow={cfg.eyebrow}
              title={cfg.title}
              description={cfg.description}
              icon={cfg.icon}
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
                  label="Power now"
                  value={reading ? fmt(reading.power != null ? (absOrNull(reading.power) as number) / 1000 : null, 2) : EM}
                  unit="kW"
                  icon={Zap}
                  tone={cfg.tone}
                  progress={reading?.power != null ? Math.min(100, ((absOrNull(reading.power) as number) / cfg.rated) * 100) : null}
                  hint={`Rated ${cfg.ratedLabel}`}
                />
                <MetricCard
                  label="Voltage"
                  value={fmt(reading?.voltage ?? null, 1)}
                  unit="V"
                  icon={Gauge}
                  tone="volt"
                  compact
                  hint={`PZEM-017 Â· address ${cfg.address}`}
                  index={1}
                />
                <MetricCard
                  label="Current"
                  value={fmt(reading?.current ?? null, 2)}
                  unit="A"
                  icon={TrendingUp}
                  tone="ion"
                  compact
                  hint="Instantaneous channel draw"
                  index={2}
                />
                <MetricCard
                  label="Probe temperature"
                  value={fmt(temp ?? null, 1)}
                  unit="Â°C"
                  icon={cfg.icon}
                  tone={temp != null && temp >= THRESHOLDS.thermal.high ? 'danger' : 'hydro'}
                  compact
                  hint={cfg.probe}
                  index={3}
                />
              </MetricGrid>

              {!reading ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetryâ€¦"
                      description={env?.empty ?? `No ${cfg.title.toLowerCase()} frames exist for this device in the selected window.`}
                      state={env?.link ?? 'unknown'}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-4">
                  <PanelHeader title="Output" subtitle="Against the rated envelope" icon={cfg.icon} />
                  <PanelBody>
                    <div className="flex justify-center">
                      <PowerGauge value={reading ? absOrNull(reading.power) : null} max={cfg.rated} size={196} tone={cfg.tone === 'sun' ? 'warn' : 'ion'} />
                    </div>
                    <div className="mt-4 space-y-3">
                      <LinearGauge
                        value={reading?.voltage ?? null}
                        max={THRESHOLDS.batteryVoltageHigh}
                        label="Channel voltage"
                        unit="V"
                        tone={cfg.tone}
                        thresholds={[THRESHOLDS.batteryVoltageLow, THRESHOLDS.batteryVoltageNominal]}
                        hint={`Aligned with the ${THRESHOLDS.batteryVoltageNominal} V DC bus`}
                      />
                      <LinearGauge
                        value={reading?.power != null ? ((absOrNull(reading.power) as number) / cfg.rated) * 100 : null}
                        max={100}
                        label="Rated utilisation"
                        unit="%"
                        tone={cfg.tone}
                        thresholds={[25, 50, 75]}
                        hint={`${cfg.ratedLabel} Â· peak in window ${fmt(p?.stats.powerPeak ?? null, 0)} W`}
                      />
                    </div>
                  </PanelBody>
                </Panel>

                <Panel className="xl:col-span-8">
                  <PanelHeader title="Yield by bucket" subtitle="Watt-hours accumulated across the window" />
                  <PanelBody>
                    <EnergyBucketChart buckets={p?.buckets ?? []} height={280} keys={[channel === 'solar' ? 'solarKwh' : 'fuelCellKwh']} />
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <StatTile label="Window yield" value={fmt(p?.totals[channel === 'solar' ? 'solarKwh' : 'fuelCellKwh'] ?? null, 3)} unit="kWh" tone={cfg.tone} />
                      <StatTile label="Share of source" value={fmt(p?.share ?? null, 1)} unit="%" tone="volt" />
                      <StatTile label="Share of mix" value={fmt(p?.contribution ?? null, 1)} unit="%" tone="ion" />
                      <StatTile label="Samples" value={p?.stats.samples ?? EM} tone="neutral" />
                    </div>
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="Power" subtitle="Channel vs traction load" />
                  <PanelBody>
                    <PowerChart points={p?.points ?? []} from={range.from} to={range.to} height={240} showBattery={false} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Voltage" subtitle="Channel vs pack" />
                  <PanelBody>
                    <VoltageChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Current" subtitle="Channel draw" />
                  <PanelBody>
                    <CurrentChart points={p?.points ?? []} from={range.from} to={range.to} height={240} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Window statistics" subtitle="Aggregated on the server" />
                  <PanelBody>
                    <div className="grid grid-cols-2 gap-2">
                      <StatTile label="Mean power" value={fmt(p?.stats.powerAvg ?? null, 1)} unit="W" tone={cfg.tone} />
                      <StatTile label="Peak power" value={fmt(p?.stats.powerPeak ?? null, 1)} unit="W" tone="warn" />
                      <StatTile label="Mean current" value={fmt(p?.stats.currentAvg ?? null, 2)} unit="A" tone="ion" />
                      <StatTile label="Peak current" value={fmt(p?.stats.currentPeak ?? null, 2)} unit="A" tone="danger" />
                      <StatTile label="Mean voltage" value={fmt(p?.stats.voltageAvg ?? null, 1)} unit="V" tone="volt" />
                      <StatTile label="Active ratio" value={fmt(p?.stats.activeRatio != null ? p.stats.activeRatio * 100 : null, 0)} unit="%" tone="hydro" />
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                      Traction bus consumed {fmt(p?.consumKwh ?? null, 3)} kWh in this window; cumulative channel energy reads{' '}
                      {fmt(reading?.energy ?? null, 3)} kWh.
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