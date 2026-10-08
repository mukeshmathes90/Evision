'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, Download, Radio, Sparkles } from 'lucide-react';
import { HeroTelemetryStrip } from '@/components/marketing/HeroTelemetryStrip';
import { LiveSection } from '@/components/live/LiveSection';
import { PowerChart, SOCChart } from '@/components/charts/Charts';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { DataSourceBadge } from '@/components/ui/EmptyState';
import { PowerGauge, SOCGauge } from '@/components/charts/Gauges';
import { VehicleVisualization, type VehicleNodeKey } from '@/components/vehicle/VehicleVisualization';
import { VehicleComponentPanel, VehicleNodePicker, VehicleTelemetryStrip } from '@/components/vehicle/VehicleComponentPanel';
import { EnergyFlow, EnergyFlowLegend } from '@/components/vehicle/EnergyFlow';
import { absOrNull, fmt, fmtClock, fmtPower, fmtPowerUnit } from '@/lib/format';
import { MOTION } from '@/lib/cn';
import type { ApiEnvelope, OverviewPayload } from '@/types';

export function VehicleShowcase({ initial, deviceId }: { initial: ApiEnvelope<OverviewPayload>; deviceId: string }) {
  const [node, setNode] = useState<VehicleNodeKey>('battery');

  return (
    <>
      <LiveSection<ApiEnvelope<OverviewPayload>>
        url={`/api/dashboard?device=${encodeURIComponent(deviceId)}&range=1h`}
        initial={initial}
        intervalMs={5000}
      >
        {(res) => {
          const env = res.ok ? res.envelope : null;
          const p = env?.data ?? null;
          const latest = p?.latest ?? null;
          const battery = p?.battery ?? null;
          const genTotal = latest ? (absOrNull(latest.solar.power) ?? 0) + (absOrNull(latest.fuelCell.power) ?? 0) : 0;

          return (
            <>
              <section className="relative">
                <div className="mx-auto max-w-[1400px] px-5 pt-10 lg:px-8">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="micro-strong">Interactive vehicle</span>
                        {env ? <DataSourceBadge source={env.source} /> : null}
                        {env?.source === 'demo' ? (
                          <span className="chip border-sun-500/40 text-sun-400">{env.deviceLabel}</span>
                        ) : null}
                      </div>
                      <h1 className="display mt-3 text-[30px] sm:text-[40px]">View my car</h1>
                      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ink-400">
                        Select a subsystem to inspect its live frame. Energy paths animate with real power magnitude and reverse
                        direction when the traction bus regenerates into the pack.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a href="/dashboard" className="btn-ghost">
                        Full dashboard
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`/api/telemetry?device=${encodeURIComponent(env?.deviceId ?? deviceId)}&range=1h&pageSize=200&format=csv`}
                        className="btn-secondary"
                        download
                      >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mx-auto max-w-[1400px] px-5 py-6 lg:px-8">
                  <div className="grid gap-4 xl:grid-cols-12">
                    <Panel className="xl:col-span-8">
                      <PanelHeader
                        title="Energy topology"
                        subtitle={latest ? `Frame ${fmtClock(latest.timestamp)} UTC` : 'No frame received yet'}
                        icon={<Radio className="h-4 w-4" />}
                      />
                      <PanelBody>
                        <VehicleNodePicker active={node} onSelect={setNode} latest={latest} />
                        <div className="mt-4">
                          <VehicleVisualization latest={latest} battery={battery} onNodeChange={setNode} />
                        </div>
                        <div className="mt-4">
                          <VehicleTelemetryStrip latest={latest} />
                        </div>
                      </PanelBody>
                    </Panel>

                    <Panel className="xl:col-span-4">
                      <PanelHeader title="Subsystem telemetry" subtitle="Values from the newest document" icon={<Sparkles className="h-4 w-4" />} />
                      <div className="min-h-[320px]">
                        <VehicleComponentPanel node={node} latest={latest} battery={battery} generationTotal={genTotal} />
                      </div>
                    </Panel>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-12">
                    <Panel className="xl:col-span-7">
                      <PanelHeader title="Power flow" subtitle="Live routing with animated paths" icon={<Activity className="h-4 w-4" />} />
                      <PanelBody>
                        <EnergyFlow latest={latest} battery={battery} orientation="vertical" />
                        <div className="mt-6">
                          <EnergyFlowLegend />
                        </div>
                      </PanelBody>
                    </Panel>

                    <Panel className="xl:col-span-5">
                      <PanelHeader title="State of charge" subtitle="AI-MODEL-01 vs bus voltage" />
                      <PanelBody>
                        <div className="-mx-2 flex flex-wrap items-center justify-center gap-2">
                          <SOCGauge value={battery?.soc ?? null} size={180} />
                          <PowerGauge value={latest?.vehicle.power ?? null} size={168} />
                        </div>
                        <div className="mt-5 h-[210px]">
                          <SOCChart points={(p?.series ?? []).slice(-60)} from={Date.now() - 3600_000} to={Date.now()} height={210} />
                        </div>
                      </PanelBody>
                    </Panel>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <Panel>
                      <PanelHeader title="Channel power" subtitle="Solar Â· fuel cell Â· traction" />
                      <PanelBody>
                        <div className="h-[240px]">
                          <PowerChart points={(p?.series ?? []).slice(-90)} from={Date.now() - 3600_000} to={Date.now()} height={240} />
                        </div>
                      </PanelBody>
                    </Panel>

                    <Panel>
                      <PanelHeader title="Energy ledger" subtitle="Watt-hours moved in the window" />
                      <PanelBody>
                        <EnergyLedger env={env} />
                      </PanelBody>
                    </Panel>
                  </div>

                  <div className="mt-4">
                    <HeroTelemetryStrip initial={initial} deviceId={deviceId} intervalMs={10000} />
                  </div>
                </div>
              </section>
            </>
          );
        }}
      </LiveSection>
    </>
  );
}

function EnergyLedger({ env }: { env: ApiEnvelope<OverviewPayload>['envelope'] | null }) {
  const rows = useMemo(() => {
    const e = env?.data.energy;
    return [
      { label: 'Solar generated', value: e?.solarKwh, color: '#FBBF24' },
      { label: 'Fuel-cell generated', value: e?.fuelCellKwh, color: '#22D3EE' },
      { label: 'Traction consumed', value: e?.vehicleKwh, color: '#60A5FA' },
      { label: 'Pack throughput', value: e?.batteryKwh, color: '#A78BFA' },
      { label: 'Net position', value: e?.netKwh, color: '#34D399' },
    ];
  }, [env]);

  const max = Math.max(0.001, ...rows.map((r) => Math.abs(r.value ?? 0)));

  return (
    <div className="space-y-3.5">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-ink-400">{r.label}</span>
            <span className="font-mono tabular-nums text-ink-100">{r.value == null ? 'â€”' : `${fmt(r.value, 3)} kWh`}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: r.color }}
              initial={{ width: 0 }}
              animate={{ width: `${((Math.abs(r.value ?? 0) / max) * 100).toFixed(1)}%` }}
              transition={{ duration: 0.8, ease: MOTION.ease, delay: i * 0.05 }}
            />
          </div>
        </div>
      ))}
      <SectionLabel className="pt-1">
        Regenerative recovery Â·{' '}
        <span className="font-mono text-ink-100">
          {env?.data.energy.regenerativeKwh == null ? 'â€”' : `${fmt(env.data.energy.regenerativeKwh, 3)} kWh`}
        </span>
        {env ? ` Â· pack net ${fmtPower(Math.abs(env.data.energy.netKwh * 1000))} ${fmtPowerUnit(env.data.energy.netKwh * 1000)}` : ''}
      </SectionLabel>
    </div>
  );
}