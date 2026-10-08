'use client';

import { useState } from 'react';
import { BellRing, Filter, Info, Search, TriangleAlert, CircleAlert, CircleCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { AlertCard, AlertSummaryStrip } from '@/components/dashboard/AlertCard';
import { ALERT_CATEGORY_META } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { AlertCategory, AlertRecord, AlertSeverity, AlertStatus, AlertsPayload, ApiEnvelope, TimeRange } from '@/types';

const SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info'];
const STATUSES: AlertStatus[] = ['active', 'acknowledged', 'resolved'];
const CATEGORIES = Object.keys(ALERT_CATEGORY_META) as AlertCategory[];

const SEVERITY_ICON: Record<AlertSeverity, typeof Info> = {
  critical: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

function matches(a: AlertRecord, search: string) {
  if (!search) return true;
  const s = search.toLowerCase();
  return `${a.message} ${a.source} ${a.category} ${a.id}`.toLowerCase().includes(s);
}

function filterAlerts(
  all: AlertRecord[],
  sev: AlertSeverity[],
  status: AlertStatus[],
  category: AlertCategory[],
  search: string,
) {
  const q = search.trim();
  return all.filter(
    (a) =>
      (!sev.length || sev.includes(a.severity)) &&
      (!status.length || status.includes(a.status)) &&
      (!category.length || category.includes(a.category)) &&
      matches(a, q),
  );
}

export function AlertsView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<AlertsPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const url = `/api/alerts?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;
  const [sev, setSev] = useState<AlertSeverity[]>([]);
  const [status, setStatus] = useState<AlertStatus[]>([]);
  const [category, setCategory] = useState<AlertCategory[]>([]);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(40);

  const toggle = <T,>(list: T[], v: T, set: (n: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const activeFilters = sev.length + status.length + category.length + (search ? 1 : 0);

  return (
    <LiveSection<ApiEnvelope<AlertsPayload>> url={url} initial={initial} intervalMs={10000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const all = p?.alerts ?? [];

        const filtered = filterAlerts(all, sev, status, category, search);

        return (
          <>
            <PageHeader
              eyebrow="Rule engine"
              title="Alerts"
              description="Threshold and anomaly events recorded from telemetry. Severity comes from the platform rule set; status reflects whether the event is still active, has been acknowledged by the edge node, or has cleared."
              icon={BellRing}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={
                <>
                  <DateRangeSelector defaultKey={range.key} />
                  <a
                    href={`/api/alerts?device=${encodeURIComponent(deviceId)}&range=${range.key}${
                      range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
                    }`}
                    className="btn-secondary !px-3 !py-2 !text-[11px]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    JSON
                  </a>
                </>
              }
            />

            <div className="space-y-4">
              {p ? <AlertSummaryStrip summary={p.summary} /> : null}

              <Panel>
                <PanelHeader
                  title="Filters"
                  subtitle={activeFilters ? `${activeFilters} active · ${filtered.length} matching` : `${all.length} alerts in window`}
                  icon={Filter}
                />
                <PanelBody>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="micro-strong mr-1">Severity</span>
                      {SEVERITIES.map((s) => {
                        const Icon = SEVERITY_ICON[s];
                        const on = sev.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggle(sev, s, setSev)}
                            className={cn(
                              'chip transition-colors',
                              on
                                ? s === 'critical'
                                  ? 'border-danger-400/40 text-danger-400'
                                  : s === 'warning'
                                    ? 'border-warn-400/40 text-warn-400'
                                    : 'border-ion-300/40 text-ion-300'
                                : 'text-ink-400 hover:text-ink-100',
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {s}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="micro-strong mr-1">Status</span>
                      {STATUSES.map((s) => {
                        const on = status.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggle(status, s, setStatus)}
                            className={cn('chip transition-colors', on ? 'border-white/25 text-ink-50' : 'text-ink-400 hover:text-ink-100')}
                          >
                            {s === 'active' ? <BellRing className="h-3 w-3" /> : <CircleCheck className="h-3 w-3" />}
                            {s}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="micro-strong mr-1">Category</span>
                      {CATEGORIES.map((c) => {
                        const on = category.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggle(category, c, setCategory)}
                            className={cn('chip transition-colors', on ? 'border-white/25 text-ink-50' : 'text-ink-400 hover:text-ink-100')}
                          >
                            {ALERT_CATEGORY_META[c].label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <label className="relative flex-1 min-w-[200px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-600" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search message, source or id…"
                          className="input !pl-9"
                        />
                      </label>
                      {activeFilters ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSev([]);
                            setStatus([]);
                            setCategory([]);
                            setSearch('');
                          }}
                          className="btn-ghost !px-3 !py-2 !text-[11px]"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </div>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Alert stream"
                  subtitle={filtered.length > limit ? `Showing newest ${limit} of ${filtered.length}` : `${filtered.length} matching`}
                  icon={BellRing}
                />
                <PanelBody>
                  {!filtered.length ? (
                    <EmptyState
                      title={all.length ? 'No alerts match these filters' : 'Waiting for telemetry…'}
                      description={
                        all.length
                          ? 'Loosen the filters to see the rest of the stream for this window.'
                          : (env?.empty ?? 'No alerts raised in the selected window.')
                      }
                      state={env?.link ?? 'unknown'}
                      action={
                        all.length ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSev([]);
                              setStatus([]);
                              setCategory([]);
                              setSearch('');
                            }}
                            className="btn-secondary !px-3 !py-2 !text-[11px]"
                          >
                            Clear filters
                          </button>
                        ) : (
                          <DateRangeSelector defaultKey={range.key} />
                        )
                      }
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {filtered.slice(0, limit).map((a, i) => (
                        <AlertCard key={a.id} alert={a} index={i} />
                      ))}
                    </div>
                  )}

                  {filtered.length > limit ? (
                    <button type="button" onClick={() => setLimit((n) => n + 40)} className="btn-secondary mt-4 w-full !py-2.5 !text-[11px]">
                      Load {Math.min(40, filtered.length - limit)} more
                    </button>
                  ) : null}
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader title="Rule catalogue" subtitle="Thresholds evaluated for this device" icon={Filter} />
                <PanelBody>
                  <SectionLabel>Severity meaning</SectionLabel>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="panel-inset px-3.5 py-3">
                      <p className="text-[12px] font-medium text-danger-400">Critical</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                        Threshold crossed far enough to threaten operation — immediate attention.
                      </p>
                    </div>
                    <div className="panel-inset px-3.5 py-3">
                      <p className="text-[12px] font-medium text-warn-400">Warning</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                        Threshold crossed once; degradation or derating is expected if it persists.
                      </p>
                    </div>
                    <div className="panel-inset px-3.5 py-3">
                      <p className="text-[12px] font-medium text-ion-300">Informational</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                        Notable reading or state change recorded for the record only.
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                    Alert state is written by the edge node and the derived pipeline on the server. This view is read-only:
                    acknowledgement and resolution are recorded upstream so the platform never claims a state it did not
                    observe.
                  </p>
                </PanelBody>
              </Panel>
            </div>
          </>
        );
      }}
    </LiveSection>
  );
}