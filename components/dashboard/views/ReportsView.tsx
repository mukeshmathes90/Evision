'use client';

import { useState } from 'react';
import { BrainCircuit, Download, FileText, Flame, Printer, Route as RouteIcon, Sparkles, Sun, Thermometer } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { EnergyBucketChart, NetEnergyChart, PowerChart, SOCChart, TemperatureChart } from '@/components/charts/Charts';
import { THRESHOLDS } from '@/lib/constants';
import { fmt, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AnalyticsPayload, ApiEnvelope, TimeRange } from '@/types';

const KINDS = [
  { key: 'daily', label: 'Daily operations', icon: FileText, blurb: 'Rolling 24-hour operational summary with headline findings.' },
  { key: 'weekly', label: 'Weekly performance', icon: RouteIcon, blurb: 'Seven-day energy, efficiency and alert picture.' },
  { key: 'monthly', label: 'Monthly sustainability', icon: Sparkles, blurb: 'Month-scale net energy position and thermal load.' },
  { key: 'trip', label: 'Trip dossier', icon: RouteIcon, blurb: 'Journey-level energy split and SOC movement.' },
  { key: 'energy', label: 'Energy flow audit', icon: Sun, blurb: 'Generation against consumption with loss estimation.' },
  { key: 'ai', label: 'AI performance', icon: BrainCircuit, blurb: 'Model confidence, latency and anomaly pressure.' },
  { key: 'thermal', label: 'Thermal compliance', icon: Thermometer, blurb: 'Probe extremes against derating limits.' },
] as const;

type Kind = (typeof KINDS)[number]['key'];

export function ReportsView({
  initial,
  deviceId,
  range,
}: {
  initial: ApiEnvelope<AnalyticsPayload>;
  deviceId: string;
  range: TimeRange;
}) {
  const [kind, setKind] = useState<Kind>('daily');
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const env = initial.envelope;
  const stats = env.data.stats;
  const points = env.data.points;
  const hasData = points.length > 0;

  const query = (extra: string) => {
    const sp = new URLSearchParams({
      device: deviceId,
      range: range.key,
      kind,
      ...(range.key === 'custom' ? { from: String(range.from), to: String(range.to) } : {}),
    });
    return `/api/reports?${sp.toString()}${extra}`;
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(query(''));
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Report generation failed');
      setReport(json.report as ReportPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Reports"
        description="Generate a print-ready dossier for any window. Each report is assembled server-side from the same aggregations the dashboards read, so the document and the screen never disagree."
        icon={FileText}
        source={env.source}
        deviceId={env.deviceId}
        actions={
          <>
            <DateRangeSelector defaultKey={range.key} />
            <button type="button" onClick={generate} disabled={loading} className="btn-primary !px-3 !py-2 !text-[11px]">
              <Sparkles className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {loading ? 'Generating…' : 'Generate'}
            </button>
            <a href={query('&format=csv')} className="btn-secondary !px-3 !py-2 !text-[11px]" download>
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
            <button type="button" onClick={() => window.print()} className="btn-secondary !px-3 !py-2 !text-[11px]">
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </>
        }
      />

      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Report type" subtitle="Seven dossier templates built on the same aggregation layer" icon={FileText} />
          <PanelBody>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {KINDS.map((k) => {
                const Icon = k.icon;
                const on = kind === k.key;
                return (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => {
                      setKind(k.key);
                      setReport(null);
                    }}
                    className={cn(
                      'rounded-xl border px-3.5 py-3 text-left transition-colors',
                      on ? 'border-white/20 bg-white/[0.05]' : 'border-white/[0.06] bg-white/[0.015] hover:border-white/[0.14]',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', on ? 'text-volt-300' : 'text-ink-400')} />
                    <p className={cn('mt-2 text-[12.5px] font-medium', on ? 'text-ink-50' : 'text-ink-200')}>{k.label}</p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-ink-500">{k.blurb}</p>
                  </button>
                );
              })}
            </div>
          </PanelBody>
        </Panel>

        {error ? (
          <Panel>
            <PanelBody>
              <EmptyState title="Report generation failed" description={error} state="offline" compact />
            </PanelBody>
          </Panel>
        ) : null}

        {report ? <ReportDocument report={report} /> : null}

        <Panel className="print:hidden">
          <PanelHeader
            title="Live window figures"
            subtitle="Exactly what the report will contain for the selected range"
            icon={Sparkles}
          />
          <PanelBody>
            {!hasData ? (
              <EmptyState
                title="Waiting for telemetry…"
                description={env.empty ?? 'No telemetry inside this window, so a report would be empty.'}
                state={env.link}
                action={<DateRangeSelector defaultKey={range.key} />}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="micro-strong">Energy ledger</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ['Solar', stats.energy.solarKwh, 'kWh', 'sun'],
                      ['Fuel cell', stats.energy.fuelCellKwh, 'kWh', 'ion'],
                      ['Pack', stats.energy.batteryKwh, 'kWh', 'volt'],
                      ['Traction', stats.energy.vehicleKwh, 'kWh', 'warn'],
                      ['Net', stats.energy.netKwh, 'kWh', 'hydro'],
                      ['Regenerated', stats.energy.regenerativeKwh, 'kWh', 'hydro'],
                    ].map(([label, value, unit]) => (
                      <div key={String(label)} className="panel-inset px-3.5 py-2.5">
                        <dt className="micro">{label}</dt>
                        <dd className="mt-1 font-mono text-[14px] tabular-nums text-ink-100">
                          {fmt(value as number | null, 3)} <span className="text-[10px] text-ink-500">{unit}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <p className="micro-strong">Window envelope</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ['Peak traction', stats.peakPowerW, 'W'],
                      ['Mean traction', stats.avgPowerW, 'W'],
                      ['SOC min', stats.soc.min, '%'],
                      ['SOC max', stats.soc.max, '%'],
                      ['Thermal max', stats.thermal.max, '°C'],
                      ['Frames', points.length, ''],
                    ].map(([label, value, unit]) => (
                      <div key={String(label)} className="panel-inset px-3.5 py-2.5">
                        <dt className="micro">{label}</dt>
                        <dd className="mt-1 font-mono text-[14px] tabular-nums text-ink-100">
                          {fmt(value as number | null, 2)} <span className="text-[10px] text-ink-500">{unit}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}
          </PanelBody>
        </Panel>

        {hasData ? (
          <div className="print:hidden">
            <Panel>
              <PanelHeader title="Power trend" subtitle="Reference chart appended to the dossier" icon={Sparkles} />
              <PanelBody>
                <PowerChart points={points} from={range.from} to={range.to} height={260} />
              </PanelBody>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}

export interface ReportPayload {
  kind: Kind;
  title: string;
  generatedAt: string;
  deviceId: string;
  source: 'live' | 'demo';
  range: { from: string; to: string; label: string };
  summary: Record<string, number>;
  findings: string[];
  series: { t: number; solar: number; fuelCell: number; vehicle: number; soc: number; tempAvg: number }[];
}

function ReportDocument({ report }: { report: ReportPayload }) {
  return (
    <Panel className="print:border-white print:bg-white">
      <PanelBody>
        <article className="space-y-6 print:text-black">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4 print:border-black/20">
            <div>
              <p className="micro">EVISION AI · Viyal Tech</p>
              <h2 className="mt-2 text-[20px] font-semibold text-ink-50 print:text-black">{report.title}</h2>
              <p className="mt-1 text-[11.5px] text-ink-500 print:text-black/60">
                Device {report.deviceId} · source {report.source.toUpperCase()} · {report.range.label}
              </p>
            </div>
            <div className="text-right">
              <p className="micro">Generated</p>
              <p className="mt-1 font-mono text-[11.5px] text-ink-300 print:text-black/70">{fmtDateTime(report.generatedAt)}</p>
            </div>
          </header>

          <section>
            <p className="micro-strong">Headline findings</p>
            <ul className="mt-3 space-y-2">
              {report.findings.map((f, i) => (
                <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-200 print:text-black/80">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-volt-400 print:bg-black/40" />
                  {f}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="micro-strong">Summary table</p>
            <div className="mt-3 -mx-1 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <tbody>
                  {Object.entries(report.summary).map(([k, v]) => (
                    <tr key={k} className="border-b border-white/[0.05] print:border-black/10">
                      <td className="px-3 py-2 text-[11.5px] capitalize text-ink-400 print:text-black/60">
                        {k.replace(/([A-Z])/g, ' $1').trim()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-ink-100 print:text-black">
                        {typeof v === 'number' ? fmt(v, 2) : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <div>
              <p className="micro-strong flex items-center gap-1.5">
                <Sun className="h-3 w-3" /> Generation vs consumption
              </p>
              <div className="mt-2">
                <EnergyBucketChart buckets={report.series.map((s) => ({ label: fmtDateTime(new Date(s.t).toISOString()).slice(5), solarKwh: s.solar / 1000, fuelCellKwh: s.fuelCell / 1000, vehicleKwh: s.vehicle / 1000, netKwh: (s.solar + s.fuelCell - s.vehicle) / 1000 }))} height={220} />
              </div>
            </div>
            <div>
              <p className="micro-strong flex items-center gap-1.5">
                <Flame className="h-3 w-3" /> Net position
              </p>
              <div className="mt-2">
                <NetEnergyChart buckets={report.series.map((s) => ({ label: fmtDateTime(new Date(s.t).toISOString()).slice(5), netKwh: (s.solar + s.fuelCell - s.vehicle) / 1000 }))} height={220} />
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <div>
              <p className="micro-strong">State of charge</p>
              <div className="mt-2">
                <SOCChart points={seriesToReportPoints(report)} from={rangeBound(report, 0)} to={rangeBound(report, 1)} height={200} />
              </div>
            </div>
            <div>
              <p className="micro-strong flex items-center gap-1.5">
                <Thermometer className="h-3 w-3" /> Thermal
              </p>
              <div className="mt-2">
                <TemperatureChart points={seriesToReportPoints(report)} from={rangeBound(report, 0)} to={rangeBound(report, 1)} height={200} withMax={false} />
              </div>
            </div>
          </section>

          <footer className="border-t border-white/[0.07] pt-3 text-[10.5px] leading-relaxed text-ink-500 print:border-black/20 print:text-black/60">
            Generated by EVISION AI from the {report.deviceId} telemetry stream. Thermal limits: warn {THRESHOLDS.thermal.warm} °C,
            high {THRESHOLDS.thermal.high} °C, derate {THRESHOLDS.thermal.critical} °C. Figures are aggregated server-side
            from stored documents. This dossier is{' '}
            <strong className="font-semibold text-ink-200 print:text-black">{report.source === 'demo' ? 'DEMO DATA' : 'LIVE DATA'}</strong>.
          </footer>
        </article>
      </PanelBody>
    </Panel>
  );
}

function rangeBound(report: ReportPayload, index: 0 | 1) {
  const t = Date.parse(report.range[index === 0 ? 'from' : 'to']);
  return Number.isFinite(t) ? t : Date.now();
}

function seriesToReportPoints(report: ReportPayload) {
  return report.series.map((s) => ({
    t: s.t,
    t1: s.tempAvg,
    t2: s.tempAvg,
    t3: s.tempAvg,
    t4: s.tempAvg,
    soc: s.soc,
    range: 0,
  }));
}