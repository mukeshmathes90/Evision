'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { EmptyState, Value } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { absOrNull, EM, fmt, fmtDateTimeSec, fmtPower } from '@/lib/format';
import type { DataEnvelope, TelemetryReading } from '@/types';

export type TelemetryTableEnvelope = DataEnvelope<{
  deviceId: string;
  rows: TelemetryReading[];
  total: number;
  page: number;
  pages: number;
}>;

interface Column {
  key: string;
  label: string;
  unit?: string;
  sortable: boolean;
  render: (r: TelemetryReading) => string;
  tone?: 'volt' | 'ion' | 'sun' | 'danger';
}

const COLUMNS: Column[] = [
  { key: 'timestamp', label: 'Timestamp (UTC)', sortable: true, render: (r) => fmtDateTimeSec(r.timestamp) },
  { key: 'power', label: 'Vehicle', unit: 'kW', sortable: true, render: (r) => fmtPower(absOrNull(r.vehicle.power)), tone: 'volt' },
  { key: 'voltage', label: 'Bus', unit: 'V', sortable: true, render: (r) => fmt(r.vehicle.voltage, 1) },
  { key: 'soc', label: 'SOC', unit: '%', sortable: true, render: (r) => fmt(r.ai.soc, 1), tone: 'ion' },
  { key: 'range', label: 'Range', unit: 'km', sortable: true, render: (r) => fmt(r.ai.range, 1) },
  { key: 'solarPower', label: 'Solar', unit: 'kW', sortable: false, render: (r) => fmtPower(absOrNull(r.solar.power)), tone: 'sun' },
  { key: 'fcPower', label: 'Stack', unit: 'kW', sortable: false, render: (r) => fmtPower(absOrNull(r.fuelCell.power)), tone: 'ion' },
  { key: 't1', label: 'T1', unit: 'Â°C', sortable: true, render: (r) => fmt(r.temperature.t1, 1) },
  { key: 't2', label: 'T2', unit: 'Â°C', sortable: false, render: (r) => fmt(r.temperature.t2, 1) },
  { key: 't3', label: 'T3', unit: 'Â°C', sortable: false, render: (r) => fmt(r.temperature.t3, 1) },
  { key: 't4', label: 'T4', unit: 'Â°C', sortable: true, render: (r) => fmt(r.temperature.t4, 1) },
  { key: 'anomaly', label: 'Anomaly', sortable: false, render: (r) => fmt(r.ai.anomalyScore, 3) },
  { key: 'mode', label: 'Pack', sortable: false, render: (r) => (r.battery?.mode ?? EM).toUpperCase() },
];

const TONE_CLASS: Record<string, string> = {
  volt: 'text-volt-300',
  ion: 'text-ion-300',
  sun: 'text-sun-400',
  danger: 'text-danger-400',
};

export function TelemetryTable({
  initial,
  deviceId,
  rangeKey,
  from,
  to,
  pageSize = 25,
}: {
  initial: TelemetryTableEnvelope;
  deviceId: string;
  rangeKey: string;
  from: number;
  to: number;
  pageSize?: number;
}) {
  const [page, setPage] = useState(initial.data.page);
  const [sort, setSort] = useState('timestamp');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const url = useMemo(() => {
    const sp = new URLSearchParams({ device: deviceId, range: rangeKey, page: String(page), pageSize: String(pageSize), sort, dir });
    if (rangeKey === 'custom') {
      sp.set('from', String(from));
      sp.set('to', String(to));
    }
    if (search.trim()) sp.set('q', search.trim());
    return `/api/telemetry?${sp.toString()}`;
  }, [deviceId, rangeKey, page, pageSize, sort, dir, search, from, to]);

  const { data, refreshing } = useLiveData<{ ok: boolean; envelope: TelemetryTableEnvelope['data']; range: unknown }>(
    url,
    { ok: true, envelope: initial.data, range: null },
    15000,
  );

  const rows = data?.envelope.rows ?? [];
  const total = data?.envelope.total ?? 0;
  const pages = data?.envelope.pages ?? 1;

  const toggleSort = (key: string) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('desc');
    }
    setPage(1);
  };

  const csvUrl = `/api/telemetry?${(() => {
    const sp = new URLSearchParams({ device: deviceId, range: rangeKey, format: 'csv', pageSize: '200' });
    if (rangeKey === 'custom') {
      sp.set('from', String(from));
      sp.set('to', String(to));
    }
    return sp.toString();
  })()}`;

  return (
    <Panel>
      <PanelHeader
        title="Telemetry documents"
        subtitle={total ? `${total.toLocaleString('en-US')} frames in window` : 'No frames in window'}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter framesâ€¦"
                className="h-8 w-44 rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-2 text-[11.5px] text-ink-100 placeholder:text-ink-600"
              />
            </label>
            <a href={csvUrl} className="btn-secondary !px-3 !py-2 !text-[11px]" download>
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
          </div>
        }
      />
      <PanelBody>
        {rows.length === 0 ? (
          <EmptyState
            title="Waiting for telemetryâ€¦"
            description="No documents match this window, filter or sort. Adjust the range or clear the filter to see stored frames."
            compact
          />
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="px-3 py-2.5 text-left">
                        <button
                          type="button"
                          disabled={!c.sortable}
                          onClick={() => c.sortable && toggleSort(c.key)}
                          className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                            c.sortable ? 'text-ink-400 hover:text-ink-100' : 'cursor-default text-ink-600',
                          )}
                        >
                          {c.label}
                          {c.unit ? <span className="text-ink-600">/{c.unit}</span> : null}
                          {c.sortable && sort === c.key ? (
                            dir === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-volt-300" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-volt-300" />
                            )
                          ) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.timestamp}-${i}`}
                      className={cn(
                        'border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]',
                        i % 2 === 1 ? 'bg-white/[0.012]' : '',
                      )}
                    >
                      {COLUMNS.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            'whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-ink-200',
                            c.tone && TONE_CLASS[c.tone],
                          )}
                        >
                          <Value value={c.render(r)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
              <p className="font-mono text-[10.5px] text-ink-500">
                Page {page} of {pages} Â· {refreshing ? 'refreshingâ€¦' : 'live'} Â· source {initial.source}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost !px-2.5 !py-1.5">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="btn-ghost !px-2.5 !py-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}