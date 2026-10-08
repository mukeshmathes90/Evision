'use client';

import {
  Activity,
  CircleDot,
  Cpu,
  Database,
  HardDrive,
  Radio,
  Router,
  Wifi,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { HARDWARE } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { EM, fmt, fmtAgo, fmtDateTime, LINK_META } from '@/lib/format';
import type { ApiEnvelope, DevicePayload } from '@/types';

const CHANNEL_TONE = {
  connected: 'text-hydro-300',
  'no-data': 'text-warn-400',
  offline: 'text-danger-400',
} as const;

export function DeviceView({ envelope }: { envelope: ApiEnvelope<DevicePayload> }) {
  const env = envelope.envelope;
  const d = env.data.device;
  const hw = env.data.hardware;
  const events = env.data.events;
  const link = LINK_META[env.link];
  const statusTone = d.status === 'online' ? 'hydro' : d.status === 'offline' ? 'danger' : 'warn';

  const specs: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Cpu, label: 'MCU', value: HARDWARE.mcu },
    { icon: Activity, label: 'AI runtime', value: HARDWARE.aiRuntime },
    { icon: Radio, label: 'Transport', value: HARDWARE.connectivity },
    { icon: HardDrive, label: 'Buffer', value: HARDWARE.storage },
    { icon: Wifi, label: 'Network', value: hw.ip ?? 'not reported' },
    { icon: Router, label: 'MQTT topic', value: hw.mqttTopic ?? 'not reported' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Node identity"
        title="Device"
        description="Registration record, channel health, live hardware snapshot and system event log for the selected edge node."
        icon={Cpu}
        source={env.source}
        deviceId={env.deviceId}
        actions={
          <a href="/api/health" className="btn-secondary !px-3 !py-2 !text-[11px]" target="_blank" rel="noreferrer">
            <Database className="h-3.5 w-3.5" />
            Storage health
          </a>
        }
      />

      <div className="space-y-4">
        <MetricGrid cols={4}>
          <MetricCard
            label="Node status"
            value={d.status}
            icon={CircleDot}
            tone={statusTone}
            hint={link.label}
          />
          <MetricCard
            label="Firmware"
            value={hw.firmware ?? 'unknown'}
            icon={Wrench}
            tone="volt"
            compact
            hint={`Registered ${fmtDateTime(d.registeredAt)}`}
            index={1}
          />
          <MetricCard
            label="Signal strength"
            value={fmt(hw.rssi ?? null, 0)}
            unit="dBm"
            icon={Wifi}
            tone={hw.rssi != null && hw.rssi < -75 ? 'warn' : 'ion'}
            progress={hw.rssi != null ? Math.min(100, Math.max(0, ((hw.rssi + 100) / 60) * 100)) : null}
            hint={hw.rssi != null && hw.rssi < -75 ? 'Weak â€” expect delayed uploads' : 'Usable for streaming'}
            index={2}
          />
          <MetricCard
            label="Uptime"
            value={hw.uptimeS != null ? fmtDurationFromSeconds(hw.uptimeS) : EM}
            icon={Activity}
            tone="hydro"
            compact
            hint={`Free heap ${hw.freeHeapBytes != null ? `${(hw.freeHeapBytes / 1024 / 1024).toFixed(1)} MB` : EM} Â· SD ${hw.sdFreeMb != null ? `${hw.sdFreeMb} MB` : EM}`}
            index={3}
          />
        </MetricGrid>

        {!d.channels.length ? (
          <Panel>
            <PanelBody>
              <EmptyState
                title="Waiting for telemetryâ€¦"
                description={env.empty ?? 'This device has no channel telemetry stored yet.'}
                state={env.link}
              />
            </PanelBody>
          </Panel>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-12">
          <Panel className="xl:col-span-7">
            <PanelHeader title="Identity" subtitle={`${d.model} Â· ${d.location}`} icon={Cpu} />
            <PanelBody>
              <div className="grid gap-2 sm:grid-cols-2">
                <StatTile label="Device id" value={d.deviceId} tone="volt" />
                <StatTile label="Name" value={d.name} tone="neutral" />
                <StatTile label="MCU" value={d.mcu} tone="ion" />
                <StatTile label="Firmware" value={d.firmware} tone="ion" />
                <StatTile label="Temperature sensors" value={String(d.temperatureSensors)} tone="hydro" />
                <StatTile label="Storage" value={d.storage === 'sd-card' ? 'MicroSD buffer' : 'None'} tone={d.storage === 'sd-card' ? 'warn' : 'neutral'} />
                <StatTile label="Last frame" value={d.lastSeen ? fmtAgo(d.lastSeen) : EM} tone="neutral" />
                <StatTile label="Registered" value={fmtDateTime(d.registeredAt)} tone="neutral" />
              </div>

              <SectionLabel className="mt-6">AI models on this node</SectionLabel>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.aiModels.map((m) => (
                  <span key={m} className="chip">
                    {m}
                  </span>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel className="xl:col-span-5">
            <PanelHeader title="Channel health" subtitle="Modbus RTU addresses" icon={Radio} />
            <PanelBody>
              <div className="space-y-2">
                {d.channels.map((c) => (
                  <div key={c.id} className="panel-inset px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-ink-100">{c.label}</p>
                        <p className="mt-0.5 font-mono text-[10.5px] text-ink-500">
                          {c.address} Â· {c.role}
                        </p>
                      </div>
                      <span className={cn('chip !px-2 !py-0.5', CHANNEL_TONE[c.state])}>{c.state}</span>
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-ink-600">
                      {c.lastReading ? `last reading ${fmtDateTime(c.lastReading)}` : 'no reading recorded'}
                    </p>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Hardware snapshot" subtitle="Values carried in the latest telemetry frame" icon={Activity} />
            <PanelBody>
              <div className="grid gap-2 sm:grid-cols-3">
                {specs.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="panel-inset px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-ink-500" />
                        <p className="micro">{s.label}</p>
                      </div>
                      <p className="mt-2 font-mono text-[12px] leading-relaxed text-ink-100">{s.value}</p>
                    </div>
                  );
                })}
              </div>
              {hw.battery ? (
                <>
                  <SectionLabel className="mt-6">Pack as seen by the node</SectionLabel>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatTile label="SOC" value={fmt(hw.battery.soc, 1)} unit="%" tone="volt" compact />
                    <StatTile label="Mode" value={hw.battery.mode} tone="ion" compact />
                    <StatTile label="Health" value={fmt(hw.battery.healthPct, 0)} unit="%" tone="hydro" compact />
                    <StatTile label="Cycles" value={String(hw.battery.cycles)} tone="neutral" compact />
                  </div>
                </>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="System events" subtitle={`${events.length} recorded entries`} icon={Activity} />
            <PanelBody>
              {events.length ? (
                <ol className="relative space-y-3 border-l border-white/[0.08] pl-5">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[26px] top-1.5 h-2 w-2 rounded-full ring-4 ring-void-950',
                          e.severity === 'critical'
                            ? 'bg-danger-400'
                            : e.severity === 'warning'
                              ? 'bg-warn-400'
                              : 'bg-hydro-400',
                        )}
                      />
                      <p className="text-[12px] text-ink-100">{e.message}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-600">
                        {e.type} Â· {fmtDateTime(e.timestamp)}
                        {e.detail ? ` Â· ${e.detail}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title="No system events"
                  description="The node has not reported boots, network changes or storage events in this log."
                  state={env.link}
                  compact
                />
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}

function fmtDurationFromSeconds(total: number) {
  const s = Math.max(0, Math.floor(total));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const mins = Math.floor((s % 3_600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m ${s % 60}s`;
}