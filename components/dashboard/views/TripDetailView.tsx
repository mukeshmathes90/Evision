'use client';

import { ArrowLeft, BatteryCharging, BrainCircuit, Clock, Fuel, Route as RouteIcon, Sun, Thermometer, Zap } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { CurrentChart, PowerChart, SOCChart, TemperatureChart } from '@/components/charts/Charts';
import { THRESHOLDS } from '@/lib/constants';
import { EM, fmt, fmtDateTime, fmtDuration } from '@/lib/format';
import type { ApiEnvelope, TripRecord } from '@/types';

export function TripDetailView({ envelope, tripId }: { envelope: ApiEnvelope<TripRecord | null>; tripId: string }) {
  const t = envelope.envelope.data;
  const source = envelope.envelope.source;
  const link = envelope.envelope.link;
  const deviceId = envelope.envelope.deviceId;

  if (!t) {
    return (
      <>
        <PageHeader
          eyebrow="Journey"
          title="Trip not found"
          description={`No reconstructed journey matches ${tripId}.`}
          icon={RouteIcon}
          source={source}
          deviceId={deviceId}
          actions={
            <Link href="/dashboard/trips" className="btn-secondary !px-3 !py-2 !text-[11px]">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to trips
            </Link>
          }
        />
        <Panel>
          <PanelBody>
            <EmptyState
              title="Waiting for telemetryâ€¦"
              description={envelope.envelope.empty ?? 'This trip does not exist for the selected device.'}
              state={link}
            />
          </PanelBody>
        </Panel>
      </>
    );
  }

  const startMs = Date.parse(t.startTime);
  const endMs = t.endTime ? Date.parse(t.endTime) : Number.NaN;
  const durationS = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.round((endMs - startMs) / 1000) : null;
  const avgSpeedKph = durationS && durationS > 0 && t.distanceKm > 0 ? t.distanceKm / (durationS / 3600) : null;
  const whPerKm = t.distanceKm > 0 ? t.efficiencyKwhPerKm * 1000 : null;
  const socDrop = Math.max(0, t.startSoc - t.endSoc);
  const points = t.points;

  return (
    <>
      <PageHeader
        eyebrow="Journey detail"
        title={fmtDateTime(t.startTime)}
        description={`${t.startSoc.toFixed(0)} % â†’ ${t.endSoc.toFixed(0)} % state of charge across ${t.distanceKm.toFixed(2)} km, reconstructed from channel 0x03.`}
        icon={RouteIcon}
        source={source}
        deviceId={deviceId}
        actions={
          <>
            <Link href={`/dashboard/trips?device=${encodeURIComponent(deviceId)}`} className="btn-secondary !px-3 !py-2 !text-[11px]">
              <ArrowLeft className="h-3.5 w-3.5" />
              All trips
            </Link>
            <Link
              href={`/api/trips/${t.id}?device=${encodeURIComponent(deviceId)}&format=csv`}
              className="btn-secondary !px-3 !py-2 !text-[11px]"
              download
            >
              <Zap className="h-3.5 w-3.5" />
              Frames CSV
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        <MetricGrid cols={4}>
          <MetricCard
            label="Distance"
            value={fmt(t.distanceKm, 2)}
            unit="km"
            icon={RouteIcon}
            tone="volt"
            hint={avgSpeedKph != null ? `${fmt(avgSpeedKph, 1)} km/h average` : 'Speed unavailable'}
          />
          <MetricCard
            label="Duration"
            value={durationS != null ? fmtDuration(durationS) : EM}
            icon={Clock}
            tone="ion"
            compact
            hint={t.endTime ? `Ended ${fmtDateTime(t.endTime)}` : 'Journey still in progress'}
            index={1}
          />
          <MetricCard
            label="Energy consumed"
            value={fmt(t.energyKwh, 3)}
            unit="kWh"
            icon={BatteryCharging}
            tone="hydro"
            hint={whPerKm != null ? `${fmt(whPerKm, 1)} Wh/km` : 'Distance unavailable'}
            index={2}
          />
          <MetricCard
            label="Mean traction power"
            value={fmt(t.avgPowerW, 0)}
            unit="W"
            icon={Zap}
            tone="warn"
            progress={Number.isFinite(t.avgPowerW) ? Math.min(100, (t.avgPowerW / THRESHOLDS.vehiclePowerHigh) * 100) : null}
            hint={`Peak ${fmt(t.peakPowerW, 0)} W`}
            index={3}
          />
        </MetricGrid>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel>
            <PanelHeader title="Charge" subtitle="Departure to arrival" icon={BatteryCharging} />
            <PanelBody>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Start SOC" value={fmt(t.startSoc, 1)} unit="%" tone="volt" />
                <StatTile label="End SOC" value={fmt(t.endSoc, 1)} unit="%" tone="volt" />
                <StatTile label="Drop" value={fmt(socDrop, 1)} unit="%" tone={socDrop > 30 ? 'warn' : 'hydro'} />
                <StatTile label="Efficiency" value={fmt(whPerKm, 1)} unit="Wh/km" tone="ion" />
              </div>
              <div className="mt-4 space-y-2.5">
                <div>
                  <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    <span>Departure</span>
                    <span className="font-mono text-ink-300">{t.startSoc.toFixed(0)} %</span>
                  </div>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-hydro-400" style={{ width: `${t.startSoc}%` }} />
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    <span>Arrival</span>
                    <span className="font-mono text-ink-300">{t.endSoc.toFixed(0)} %</span>
                  </div>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-gradient-to-r from-hydro-400 to-cyan-400" style={{ width: `${t.endSoc}%` }} />
                  </span>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Energy split" subtitle="Where the kWh came from" icon={Fuel} />
            <PanelBody>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="From pack" value={fmt(t.energyKwh, 3)} unit="kWh" tone="volt" />
                <StatTile label="Solar" value={fmt(t.solarKwh, 3)} unit="kWh" tone="sun" />
                <StatTile label="Fuel cell" value={fmt(t.fuelCellKwh, 3)} unit="kWh" tone="ion" />
                <StatTile label="Regenerated" value={fmt(t.regenerativeKwh, 3)} unit="kWh" tone="hydro" />
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                Regenerative braking returned {fmt(t.regenerativeKwh, 3)} kWh to the pack during this journey â€”{' '}
                {t.energyKwh > 0 ? fmt((t.regenerativeKwh / t.energyKwh) * 100, 1) : EM} % of the energy drawn.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Thermal" subtitle="Probe extremes on this journey" icon={Thermometer} />
            <PanelBody>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Mean" value={fmt(t.avgTempC, 1)} unit="Â°C" tone="neutral" />
                <StatTile label="Peak" value={fmt(t.maxTempC, 1)} unit="Â°C" tone={t.maxTempC >= THRESHOLDS.thermal.high ? 'danger' : 'warn'} />
                <StatTile label="High limit" value={THRESHOLDS.thermal.high} unit="Â°C" tone="warn" />
                <StatTile label="Derate limit" value={THRESHOLDS.thermal.critical} unit="Â°C" tone="danger" />
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                {t.maxTempC >= THRESHOLDS.thermal.high
                  ? 'Peak temperature crossed the high limit â€” expect derating notices on this journey.'
                  : 'Peak temperature stayed inside the high limit for the whole journey.'}
              </p>
            </PanelBody>
          </Panel>
        </div>

        {points.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Power trace" subtitle="Traction load vs sources" icon={Zap} />
              <PanelBody>
                <PowerChart points={points} from={points[0].t} to={points[points.length - 1].t} height={240} />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Current trace" subtitle="Channel draw" icon={Zap} />
              <PanelBody>
                <CurrentChart points={points} from={points[0].t} to={points[points.length - 1].t} height={240} />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="State of charge" subtitle="Inference during the journey" icon={BatteryCharging} />
              <PanelBody>
                <SOCChart points={points} from={points[0].t} to={points[points.length - 1].t} height={230} />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Temperature trace" subtitle="Four probes" icon={Thermometer} />
              <PanelBody>
                <TemperatureChart points={points} from={points[0].t} to={points[points.length - 1].t} height={230} />
              </PanelBody>
            </Panel>
          </div>
        ) : null}

        <Panel>
          <PanelHeader title="AI annotations" subtitle="Model events recorded during this journey" icon={BrainCircuit} />
          <PanelBody>
            <SectionLabel>Timeline</SectionLabel>
            {t.aiEvents?.length ? (
              <ol className="mt-4 space-y-2.5">
                {t.aiEvents.map((e, i) => (
                  <li key={`${e.id}-${i}`} className="panel-inset flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                    <div>
                      <p className="text-[12px] text-ink-100">{e.label}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">{e.detail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="chip !px-2 !py-0.5">{e.model.toUpperCase()}</span>
                      <span className="font-mono text-[10px] text-ink-600">{fmtDateTime(e.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[11px] text-ink-500">
                No model crossed a confidence or anomaly threshold during this journey.
              </p>
            )}
          </PanelBody>
        </Panel>

        <p className="flex items-center gap-2 px-1 text-[11px] text-ink-600">
          <Sun className="h-3.5 w-3.5" />
          Trip id {t.id} Â· device {t.deviceId} Â· {points.length} retained frames
        </p>
      </div>
    </>
  );
}