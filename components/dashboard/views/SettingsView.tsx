'use client';

import { Bell, Check, Database, Gauge, KeyRound, Info, Lock, Radio, Server, Settings2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/MetricCard';
import { HARDWARE, THRESHOLDS } from '@/lib/constants';
import { RANGE_PRESETS } from '@/lib/time-range';
import { cn } from '@/lib/cn';
import { EM, fmt, fmtDateTime, LINK_META } from '@/lib/format';
import type { DataEnvelope, DevicePayload, FleetRow } from '@/types';

export interface SettingsDatabaseHealth {
  configured: boolean;
  connected: boolean;
  state: string;
  host: string;
  latencyMs: number | null;
  error: string | null;
  name: string;
  collections: Record<string, string>;
}

export interface SettingsRuntime {
  deviceId: string;
  database: SettingsDatabaseHealth;
  fleet: FleetRow[];
  authRequired: boolean;
  generatedAt: string;
  thresholds: typeof THRESHOLDS;
}

function Toggle({ label, hint, defaultOn = true }: { label: string; hint: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="panel-inset flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[12.5px] text-ink-100">{label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          on ? 'bg-volt-400/80' : 'bg-white/[0.10]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-void-950 transition-all',
            on ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

function ValueRow({ icon: Icon, label, value, tone = 'text-ink-100' }: { icon: typeof Info; label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="flex items-center gap-2 text-[11.5px] text-ink-400">
        <Icon className="h-3.5 w-3.5 text-ink-600" />
        {label}
      </span>
      <span className={cn('font-mono text-[11.5px]', tone)}>{value}</span>
    </div>
  );
}

export function SettingsView({
  runtime,
  envelope,
}: {
  runtime: SettingsRuntime;
  envelope: DataEnvelope<DevicePayload>;
}) {
  const db = runtime.database;
  const hw = envelope.data.hardware;
  const link = LINK_META[envelope.link];

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Runtime configuration as resolved on the server for this deployment. Secrets are never sent to the browser â€” this page shows only what the platform actually uses."
        icon={Settings2}
        source={envelope.source}
        deviceId={envelope.deviceId}
      />

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Presentation" subtitle="Client-side preferences for this browser session" icon={Gauge} />
            <PanelBody>
              <div className="space-y-2.5">
                <Toggle
                  label="Reduce motion"
                  hint="Disables chart animation and panel transitions. Use it on shared displays or when running from a vehicle mount."
                  defaultOn={false}
                />
                <Toggle
                  label="Compact tables"
                  hint="Tightens row padding in the Data page so more frames fit on screen."
                />
                <Toggle
                  label="Show demo banner"
                  hint="Keeps the demo-data notice pinned on every page. Hiding it never changes the underlying data source."
                />
              </div>

              <SectionLabel className="mt-6">Default windows</SectionLabel>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RANGE_PRESETS.map((p) => (
                  <StatTile key={p.key} label={p.label} value={`${p.points} pts`} tone="neutral" compact />
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
                The active window is carried in the URL, so a link always reopens the exact view it was copied from.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Notifications" subtitle="Alert delivery for this device" icon={Bell} />
            <PanelBody>
              <div className="space-y-2.5">
                <Toggle label="Critical alerts" hint="Thermal critical, over-voltage and AI anomaly-critical events." />
                <Toggle label="Warning alerts" hint="Threshold first crossings such as low state of charge or rising probe temperature." />
                <Toggle
                  label="Link state changes"
                  hint="When the node crosses the delayed or offline window derived from its last frame."
                  defaultOn={false}
                />
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                Notifications follow the server-rendered alert stream. Nothing is delivered from this browser, and the
                platform does not store per-user notification records.
              </p>
              <SectionLabel className="mt-6">Active thresholds</SectionLabel>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <StatTile label="SOC warning" value={THRESHOLDS.socLow} unit="%" tone="warn" compact />
                <StatTile label="SOC critical" value={THRESHOLDS.socCritical} unit="%" tone="danger" compact />
                <StatTile label="Thermal high" value={THRESHOLDS.thermal.high} unit="Â°C" tone="warn" compact />
                <StatTile label="Thermal derate" value={THRESHOLDS.thermal.critical} unit="Â°C" tone="danger" compact />
                <StatTile label="Bus low" value={THRESHOLDS.batteryVoltageLow} unit="V" tone="warn" compact />
                <StatTile label="Bus high" value={THRESHOLDS.batteryVoltageHigh} unit="V" tone="danger" compact />
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Data source" subtitle="Server-side resolution for this request" icon={Database} />
            <PanelBody>
              <ValueRow icon={Server} label="Database" value={db.name} />
              <ValueRow icon={Database} label="Connection" value={db.connected ? 'connected' : db.configured ? 'configured, not connected' : 'not configured'} tone={db.connected ? 'text-hydro-300' : 'text-danger-400'} />
              <ValueRow icon={Radio} label="Latency" value={db.latencyMs != null ? `${db.latencyMs} ms` : EM} />
              <ValueRow icon={Check} label="Health probe" value={db.connected ? 'ok' : (db.error ?? 'unavailable')} tone={db.connected ? 'text-hydro-300' : 'text-warn-400'} />
              <ValueRow icon={Info} label="Collections" value={Object.keys(db.collections ?? {}).length ? Object.keys(db.collections ?? {}).length + ' registered' : 'default set'} />
              <ValueRow icon={Radio} label="Link state" value={link.label} tone={envelope.link === 'online' ? 'text-hydro-300' : 'text-warn-400'} />
              <ValueRow icon={Info} label="Last frame" value={envelope.lastSeen ? fmtDateTime(envelope.lastSeen) : EM} />

              {db.collections && Object.keys(db.collections).length ? (
                <div className="mt-4">
                  <SectionLabel>Registered collections</SectionLabel>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.keys(db.collections).map((c) => (
                      <span key={c} className="chip">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                <p className="text-[11px] leading-relaxed text-ink-400">
                  Connection strings, tokens and database credentials stay in server environment variables. This page is
                  rendered on the server and only receives the resolved, non-sensitive values above.
                </p>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Deployment" subtitle="Firmware and ingest contract" icon={ShieldCheck} />
            <PanelBody>
              <ValueRow icon={Radio} label="Active device" value={runtime.deviceId} />
              <ValueRow icon={ShieldCheck} label="API auth" value={runtime.authRequired ? 'token required' : 'open (set API_TOKEN)'} tone={runtime.authRequired ? 'text-hydro-300' : 'text-warn-400'} />
              <ValueRow icon={KeyRound} label="MQTT topic" value={hw.mqttTopic ?? 'not reported'} />
              <ValueRow icon={Gauge} label="MCU" value={HARDWARE.mcuShort} />
              <ValueRow icon={Gauge} label="Firmware" value={hw.firmware ?? 'unknown'} />
              <ValueRow icon={Radio} label="Signal" value={hw.rssi != null ? `${hw.rssi} dBm` : EM} />
              <ValueRow icon={Database} label="SD free" value={hw.sdFreeMb != null ? `${hw.sdFreeMb} MB` : EM} />

              <SectionLabel className="mt-6">Registered nodes</SectionLabel>
              <div className="mt-3 space-y-2">
                {runtime.fleet.map((f) => (
                  <div key={f.deviceId} className="panel-inset flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-ink-100">{f.deviceId}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-ink-500">{f.location}</p>
                    </div>
                    <span
                      className={cn(
                        'chip !px-2 !py-0.5',
                        f.status === 'online'
                          ? 'text-hydro-300'
                          : f.status === 'delayed'
                            ? 'text-warn-400'
                            : 'text-danger-400',
                      )}
                    >
                      {f.status}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                Platform configuration is resolved at {fmtDateTime(runtime.generatedAt)} UTC. Changing ingestion settings
                means updating firmware and Atlas, not this page.
              </p>
            </PanelBody>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Threshold reference" subtitle="Single source of truth used by alerts, charts and reports" icon={Gauge} />
          <PanelBody>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Bus nominal" value={THRESHOLDS.batteryVoltageNominal} unit="V" tone="volt" compact />
              <StatTile label="Bus low" value={THRESHOLDS.batteryVoltageLow} unit="V" tone="warn" compact />
              <StatTile label="Bus high" value={THRESHOLDS.batteryVoltageHigh} unit="V" tone="danger" compact />
              <StatTile label="Traction current" value={THRESHOLDS.vehicleCurrentHigh} unit="A" tone="danger" compact />
              <StatTile label="Traction power" value={THRESHOLDS.vehiclePowerHigh} unit="W" tone="warn" compact />
              <StatTile label="Anomaly warning" value={THRESHOLDS.anomaly.warning} tone="ion" compact />
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
              Anomaly critical {THRESHOLDS.anomaly.critical} Â· thermal warm {THRESHOLDS.thermal.warm} Â°C, high{' '}
              {THRESHOLDS.thermal.high} Â°C, derate {THRESHOLDS.thermal.critical} Â°C Â· solar array{' '}
              {fmt(THRESHOLDS.solarPowerNominal / 1000, 1)} kWp Â· fuel-cell stack{' '}
              {fmt(THRESHOLDS.fuelCellPowerNominal / 1000, 1)} kW.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}