'use client';

import { Database, FileJson, Filter, History, Layers, Rows3, Table2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { TelemetryTable } from '@/components/dashboard/TelemetryTable';
import { THRESHOLDS } from '@/lib/constants';
import { EM, fmt, fmtDateTimeSec } from '@/lib/format';
import type { DataEnvelope, TelemetryTablePayload, TimeRange } from '@/types';

const DATABASE_NAME = 'evision';

export function DataView({
  initial,
  deviceId,
  range,
}: {
  initial: DataEnvelope<TelemetryTablePayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const table = initial.data;
  const rows = table.rows;
  const voltages = rows.map((r) => r.vehicle.voltage).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const voltageMin = voltages.length ? Math.min(...voltages) : null;
  const voltageMax = voltages.length ? Math.max(...voltages) : null;

  return (
    <>
      <PageHeader
        eyebrow="Raw store"
        title="Data"
        description={`Direct access to the ${DATABASE_NAME}.telemetry collection as stored. No aggregation, no smoothing — exactly the documents the edge node wrote, with server-side sorting, filtering and CSV export.`}
        icon={Database}
        source={initial.source}
        deviceId={initial.deviceId}
        actions={
          <>
            <DateRangeSelector defaultKey={range.key} />
            <a
              href={`/api/telemetry/history?device=${encodeURIComponent(deviceId)}&range=${range.key}${
                range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
              }`}
              className="btn-secondary !px-3 !py-2 !text-[11px]"
              target="_blank"
              rel="noreferrer"
            >
              <History className="h-3.5 w-3.5" />
              History API
            </a>
          </>
        }
      />

      <div className="space-y-4">
        <MetricGrid cols={4}>
          <MetricCard
            label="Documents in window"
            value={table.total ? table.total.toLocaleString('en-US') : EM}
            icon={Rows3}
            tone="volt"
            hint={`Page ${table.page} of ${table.pages} · ${rows.length} rows rendered`}
          />
          <MetricCard
            label="Collection"
            value="telemetry"
            icon={Table2}
            tone="ion"
            compact
            hint={`Database ${DATABASE_NAME}`}
            index={1}
          />
          <MetricCard
            label="Latest frame"
            value={rows[0] ? fmtDateTimeSec(rows[0].timestamp) : EM}
            icon={Layers}
            tone="neutral"
            compact
            hint={initial.lastSeen ? `Device last seen ${fmtDateTimeSec(initial.lastSeen)}` : 'No frames received'}
            index={2}
          />
          <MetricCard
            label="Bus voltage span"
            value={voltageMin != null && voltageMax != null ? `${fmt(voltageMin, 1)} – ${fmt(voltageMax, 1)}` : EM}
            unit="V"
            icon={Filter}
            tone="warn"
            progress={voltageMax != null ? Math.min(100, (voltageMax / THRESHOLDS.batteryVoltageHigh) * 100) : null}
            hint={`Nominal ${THRESHOLDS.batteryVoltageNominal} V · low ${THRESHOLDS.batteryVoltageLow} V`}
            index={3}
          />
        </MetricGrid>

        {!rows.length ? (
          <Panel>
            <PanelBody>
              <EmptyState
                title="Waiting for telemetry…"
                description={initial.empty ?? 'No documents match this window, filter or sort.'}
                state={initial.link}
                action={<DateRangeSelector defaultKey={range.key} />}
              />
            </PanelBody>
          </Panel>
        ) : (
          <TelemetryTable
            initial={initial}
            deviceId={deviceId}
            rangeKey={range.key}
            from={range.from}
            to={range.to}
            pageSize={25}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader
              title="Firebase Realtime Database"
              subtitle="Write target for the ESP32-S3 telemetry pipeline"
              icon={Database}
            />
            <PanelBody>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.07]">
                      {['Path', 'Purpose', 'Retention'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COLLECTION_PURPOSE.map((c) => (
                      <tr key={c.name} className="border-b border-white/[0.04]">
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-volt-300">{c.name}</td>
                        <td className="px-3 py-2.5 text-[11.5px] text-ink-300">{c.purpose}</td>
                        <td className="px-3 py-2.5 text-[11.5px] text-ink-500">{c.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SectionLabel className="mt-6">Direct reads</SectionLabel>
              <div className="mt-3 space-y-2">
                <CodeLine
                  icon={FileJson}
                  label="Paginated frames with sorting and search"
                  path={`/api/telemetry?device=${deviceId}&range=${range.key}&page=1&pageSize=25&sort=timestamp&dir=desc`}
                />
                <CodeLine
                  icon={History}
                  label="Downsampled history for long windows"
                  path={`/api/telemetry/history?device=${deviceId}&range=${range.key}`}
                />
                <CodeLine
                  icon={Database}
                  label="Database health and layout probe"
                  path="/api/health"
                />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Data hygiene" subtitle="What this page does not do" icon={Trash2} />
            <PanelBody>
              <ul className="space-y-3">
                <li className="panel-inset px-3.5 py-3">
                  <p className="text-[12px] text-ink-100">No fabricated rows</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                    Every cell is read from a stored document. Empty windows render an explicit waiting state.
                  </p>
                </li>
                <li className="panel-inset px-3.5 py-3">
                  <p className="text-[12px] text-ink-100">No destructive actions</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                    Retention and TTL policy live in Atlas. This platform only reads and exports.
                  </p>
                </li>
                <li className="panel-inset px-3.5 py-3">
                  <p className="text-[12px] text-ink-100">Server-side only</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                    Connection strings stay in server route handlers; the browser never receives credentials.
                  </p>
                </li>
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <StatTile label="Page size" value="25" tone="neutral" compact />
                <StatTile label="Max export" value="200" unit="rows" tone="neutral" compact />
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}

const COLLECTION_PURPOSE = [
  { name: 'telemetry/<device>', purpose: 'Raw PZEM + DS18B20 + AI frames', retention: 'Per-device frame history' },
  { name: 'devices/<device>', purpose: 'Registration, channels, firmware', retention: 'Persistent' },
  { name: 'layout (runtime)', purpose: 'Auto-discovered frame location', retention: 'Cached per session' },
];

function CodeLine({ icon: Icon, label, path }: { icon: typeof FileJson; label: string; path: string }) {
  return (
    <a
      href={path}
      target="_blank"
      rel="noreferrer"
      className="panel-inset flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:border-white/[0.16]"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
      <div className="min-w-0">
        <p className="text-[11.5px] text-ink-200">{label}</p>
        <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-600">{path}</p>
      </div>
    </a>
  );
}