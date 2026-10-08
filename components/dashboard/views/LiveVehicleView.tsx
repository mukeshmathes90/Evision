'use client';

import Link from 'next/link';
import { BatteryCharging, Download, Flame, Radio, Sun, Thermometer, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { CurrentChart, PowerChart, TemperatureChart, VoltageChart } from '@/components/charts/Charts';
import { VehicleVisualization, type VehicleNodeKey } from '@/components/vehicle/VehicleVisualization';
import { VehicleComponentPanel, VehicleNodePicker, VehicleTelemetryStrip } from '@/components/vehicle/VehicleComponentPanel';
import { EnergyFlow } from '@/components/vehicle/EnergyFlow';
import { THRESHOLDS } from '@/lib/constants';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit, fmtAgo } from '@/lib/format';
import { useState } from 'react';
import type { ApiEnvelope, LivePayload, TimeRange } from '@/types';

export function LiveVehicleView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<LivePayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const [node, setNode] = useState<VehicleNodeKey>('battery');
  const url = `/api/live?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<LivePayload>> url={url} initial={initial} intervalMs={3000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const latest = p?.latest ?? null;
        const genTotal = latest ? (absOrNull(latest.solar.power) ?? 0) + (absOrNull(latest.fuelCell.power) ?? 0) : 0;

        return (
          <>
            <PageHeader
              eyebrow="Real-time"
              title="Live vehicle"
              description="Three-second refresh across every channel: three PZEM-017 energy meters, four DS18B20 probes and the edge AI outputs, straight from the newest telemetry document."
              icon={Radio}
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
                  label="Traction power"
                  value={latest ? fmtPower(absOrNull(latest.vehicle.power)) : EM}
                  unit={latest ? fmtPowerUnit(latest.vehicle.power) : ''}
                  icon={Zap}
                  tone="volt"
                  progress={latest?.vehicle.power != null ? Math.min(100, (absOrNull(latest.vehicle.power) as number / THRESHOLDS.vehiclePowerHigh) * 100) : null}
                  hint={`Ceiling ${(THRESHOLDS.vehiclePowerHigh / 1000).toFixed(1)} kW continuous`}
                />
                <MetricCard
                  label="Traction current"
                  value={latest ? fmt(latest.vehicle.current) : EM}
                  unit="A"
                  icon={Zap}
                  tone="ion"
                  progress={latest?.vehicle.current != null ? Math.min(100, (absOrNull(latest.vehicle.current) as number / THRESHOLDS.vehicleCurrentHigh) * 100) : null}
                  hint={`Contactor limit ${THRESHOLDS.vehicleCurrentHigh} A`}
                  index={1}
                />
                <MetricCard
                  label="Bus voltage"
                  value={latest ? fmt(latest.vehicle.voltage) : EM}
                  unit="V"
                  icon={BatteryCharging}
                  tone="hydro"
                  progress={latest?.vehicle.voltage != null ? Math.min(100, (latest.vehicle.voltage / THRESHOLDS.batteryVoltageHigh) * 100) : null}
                  hint={`Nominal ${THRESHOLDS.batteryVoltageNominal} V Â· low ${THRESHOLDS.batteryVoltageLow} V`}
                  index={2}
                />
                <MetricCard
                  label="Last frame"
                  value={env?.lastSeen ? fmtAgo(env.lastSeen) : EM}
                  icon={Radio}
                  tone={env?.link === 'online' ? 'hydro' : env?.link === 'delayed' ? 'warn' : 'danger'}
                  hint={env ? `Link state ${env.link}` : 'Awaiting telemetry'}
                  index={3}
                />
              </MetricGrid>

              {!latest ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetryâ€¦"
                      description={env?.empty ?? 'The edge node has not written a frame for this device inside the live window.'}
                      state={env?.link ?? 'unknown'}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-8">
                  <PanelHeader title="Component explorer" subtitle="Select a subsystem to read its frame" icon={Radio} />
                  <PanelBody>
                    <VehicleNodePicker active={node} onSelect={setNode} latest={latest} />
                    <div className="mt-4">
                      <VehicleVisualization latest={latest} battery={p?.battery ?? null} onNodeChange={setNode} />
                    </div>
                    <div className="mt-4">
                      <VehicleTelemetryStrip latest={latest} />
                    </div>
                  </PanelBody>
                </Panel>
                <Panel className="xl:col-span-4">
                  <PanelHeader title="Frame detail" subtitle={latest ? latest.timestamp : 'No frame'} />
                  <div className="min-h-[340px]">
                    <VehicleComponentPanel node={node} latest={latest} battery={p?.battery ?? null} generationTotal={genTotal} />
                  </div>
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-7">
                  <PanelHeader title="Live power routing" icon={Zap} />
                  <PanelBody>
                    <EnergyFlow latest={latest} battery={p?.battery ?? null} orientation="vertical" />
                  </PanelBody>
                </Panel>
                <Panel className="xl:col-span-5">
                  <PanelHeader title="Source split" subtitle="Current contribution" icon={Flame} />
                  <PanelBody>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard
                        label="Solar"
                        value={latest ? fmtPower(absOrNull(latest.solar.power)) : EM}
                        unit={latest ? fmtPowerUnit(latest.solar.power) : ''}
                        icon={Sun}
                        tone="sun"
                        compact
                        progress={latest?.solar.power != null && genTotal > 0 ? (absOrNull(latest.solar.power) as number / genTotal) * 100 : null}
                      />
                      <MetricCard
                        label="Fuel cell"
                        value={latest ? fmtPower(absOrNull(latest.fuelCell.power)) : EM}
                        unit={latest ? fmtPowerUnit(latest.fuelCell.power) : ''}
                        icon={Flame}
                        tone="ion"
                        compact
                        progress={latest?.fuelCell.power != null && genTotal > 0 ? (absOrNull(latest.fuelCell.power) as number / genTotal) * 100 : null}
                        index={1}
                      />
                      <MetricCard
                        label="Thermal peak"
                        value={fmt(latest?.temperature.max ?? null, 1)}
                        unit="Â°C"
                        icon={Thermometer}
                        tone="danger"
                        compact
                        progress={latest?.temperature.max != null ? Math.min(100, (latest.temperature.max / THRESHOLDS.thermal.critical) * 100) : null}
                        index={2}
                      />
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                      Window averages: solar {fmt(p?.stats.solar?.powerAvg ?? null, 1)} W Â· stack{' '}
                      {fmt(p?.stats.fuelCell?.powerAvg ?? null, 1)} W Â· traction {fmt(p?.stats.vehicle?.powerAvg ?? null, 1)} W.
                    </p>
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="Power" subtitle="W Â· four channels" />
                  <PanelBody>
                    <PowerChart points={p?.points ?? []} from={range.from} to={range.to} height={230} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Voltage" subtitle="V Â· three meters + pack" />
                  <PanelBody>
                    <VoltageChart points={p?.points ?? []} from={range.from} to={range.to} height={230} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Current" subtitle="A Â· four channels" />
                  <PanelBody>
                    <CurrentChart points={p?.points ?? []} from={range.from} to={range.to} height={230} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Temperature" subtitle="Four DS18B20 probes" />
                  <PanelBody>
                    <TemperatureChart points={p?.points ?? []} from={range.from} to={range.to} height={230} />
                  </PanelBody>
                </Panel>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
                <p className="text-[11.5px] text-ink-500">
                  Frames in window <span className="font-mono text-ink-200">{p?.stats.vehicle?.samples ?? 0}</span> Â· link{' '}
                  <span className="font-mono text-ink-200">{env?.link}</span>
                </p>
                <Link href="/dashboard/thermal" className="btn-secondary !px-3.5 !py-2 !text-[11.5px]">
                  Thermal map
                </Link>
              </div>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}