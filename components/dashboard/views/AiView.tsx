'use client';

import { BrainCircuit, Cpu, GaugeCircle, Radar, Sparkles, Timer, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
import { MetricGrid, MetricCard, StatTile } from '@/components/ui/MetricCard';
import { Panel, PanelBody, PanelHeader, SectionLabel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveSection } from '@/components/live/LiveSection';
import { AnomalyChart, RangeChart, SOCChart } from '@/components/charts/Charts';
import { LinearGauge } from '@/components/charts/Gauges';
import { AI_MODELS, AI_TONE, HARDWARE, THRESHOLDS } from '@/lib/constants';
import { EM, fmt, fmtAgo, fmtDateTime, percentOf } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AiModelReport, AiPayload, ApiEnvelope, TimeRange } from '@/types';

function ModelCard({ model, index }: { model: AiModelReport; index: number }) {
  const tone = AI_TONE[model.state];
  return (
    <Panel className="relative overflow-hidden">
      <span className={cn('absolute inset-x-0 top-0 h-px', tone.dot, 'opacity-80')} />
      <PanelHeader
        title={model.name}
        subtitle={`AI-MODEL-${model.index}`}
        action={
          <span className={cn('chip', tone.text, tone.ring)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
            {tone.label}
          </span>
        }
      />
      <PanelBody>
        <p className="text-[12px] leading-relaxed text-ink-400">{model.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {model.metrics.map((m) => (
            <StatTile key={m.label} label={m.label} value={m.value} hint={m.hint} tone={model.state === 'anomaly' ? 'danger' : 'volt'} compact />
          ))}
        </div>
        <div className="mt-4 space-y-2.5">
          <LinearGauge
            value={model.confidence}
            max={100}
            label="Confidence"
            unit="%"
            tone={model.state === 'anomaly' ? 'danger' : 'volt'}
            hint={model.lastInference ? `Last inference ${fmtAgo(model.lastInference)}` : 'No inference recorded in window'}
          />
          <LinearGauge
            value={model.latencyMs}
            max={40}
            label="Inference latency"
            unit="ms"
            tone="ion"
            hint={`${model.samples.toLocaleString('en-US')} samples evaluated in window`}
          />
        </div>
      </PanelBody>
      <span className="pointer-events-none absolute bottom-2 right-4 font-mono text-[34px] leading-none text-white/[0.03]">
        {model.index}
      </span>
      <span className="sr-only">model index {index}</span>
    </Panel>
  );
}

export function AiView({ initial, deviceId, range }: { initial: ApiEnvelope<AiPayload>; deviceId: string; range: TimeRange }) {
  const url = `/api/ai?device=${encodeURIComponent(deviceId)}&range=${range.key}${
    range.key === 'custom' ? `&from=${range.from}&to=${range.to}` : ''
  }`;

  return (
    <LiveSection<ApiEnvelope<AiPayload>> url={url} initial={initial} intervalMs={8000} showIndicator>
      {(res) => {
        const env = res.ok ? res.envelope : null;
        const p = env?.data ?? null;
        const latest = p?.latest ?? null;
        const edge = p?.edge;

        return (
          <>
            <PageHeader
              eyebrow="Embedded intelligence"
              title="AI models"
              description={`${AI_MODELS.length} quantised models executing on the ${HARDWARE.mcu}. This view records their state, confidence, latency and interventions straight from the telemetry stream.`}
              icon={BrainCircuit}
              source={env?.source}
              deviceId={env?.deviceId}
              actions={<DateRangeSelector defaultKey={range.key} />}
            />

            <div className="space-y-4">
              <MetricGrid cols={4}>
                <MetricCard
                  label="SOC prediction"
                  value={fmt(latest?.ai.soc ?? null, 1)}
                  unit="%"
                  icon={GaugeCircle}
                  tone="volt"
                  progress={latest?.ai.soc ?? null}
                  hint="AI-MODEL-01 · state of charge forecast"
                />
                <MetricCard
                  label="Range prediction"
                  value={fmt(latest?.ai.range ?? null, 1)}
                  unit="km"
                  icon={Radar}
                  tone="ion"
                  hint={`AI-MODEL-02 · ${edge?.horizonS ?? 180} s horizon`}
                  index={1}
                />
                <MetricCard
                  label="Anomaly score"
                  value={fmt(latest?.ai.anomalyScore ?? null, 3)}
                  icon={TriangleAlert}
                  tone={edge?.health === 'anomaly' ? 'danger' : edge?.health === 'warning' ? 'warn' : 'hydro'}
                  progress={percentOf(latest?.ai.anomalyScore, 1)}
                  hint={`Warning ${THRESHOLDS.anomaly.warning.toFixed(2)} · critical ${THRESHOLDS.anomaly.critical.toFixed(2)}`}
                  index={2}
                />
                <MetricCard
                  label="Inference latency"
                  value={fmt(edge?.inferenceMs ?? latest?.ai.inferenceMs ?? null, 2)}
                  unit="ms"
                  icon={Timer}
                  tone="ion"
                  compact
                  hint={`${edge?.modelsActive ?? 0} models active on the edge node`}
                  index={3}
                />
              </MetricGrid>

              {!p?.models.length ? (
                <Panel>
                  <PanelBody>
                    <EmptyState
                      title="Waiting for telemetry…"
                      description={env?.empty ?? 'No model outputs have been recorded for this device in the selected window.'}
                      state={env?.link ?? 'unknown'}
                    />
                  </PanelBody>
                </Panel>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-3">
                {(p?.models ?? []).map((m, i) => (
                  <ModelCard key={m.key} model={m} index={i} />
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-12">
                <Panel className="xl:col-span-7">
                  <PanelHeader title="Inference timeline" subtitle="Model outputs across the window" icon={Sparkles} />
                  <PanelBody>
                    {p?.timeline?.length ? (
                      <ol className="relative space-y-3 border-l border-white/[0.08] pl-5">
                        {p.timeline.slice(0, 18).map((e, i) => {
                          const tone = AI_TONE[e.status === 'critical' ? 'anomaly' : e.status === 'warning' ? 'warning' : 'normal'];
                          return (
                            <li key={`${e.timestamp}-${i}`} className="relative">
                              <span className={cn('absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-void-950', tone.dot)} />
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn('text-[12px] font-medium', tone.text)}>{e.label}</span>
                                <span className="chip !px-2 !py-0.5">{e.model.toUpperCase()}</span>
                                <span className="font-mono text-[9.5px] text-ink-600">{fmtDateTime(e.timestamp)}</span>
                              </div>
                              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">{e.detail}</p>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <EmptyState
                        title="No model events in this window"
                        description="Inference ran without crossing a confidence or anomaly threshold."
                        state="online"
                        compact
                      />
                    )}
                  </PanelBody>
                </Panel>

                <Panel className="xl:col-span-5">
                  <PanelHeader title="Edge runtime" subtitle={HARDWARE.aiRuntime} icon={Cpu} />
                  <PanelBody>
                    <SectionLabel>Runtime context</SectionLabel>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <StatTile label="MCU" value={HARDWARE.mcuShort} tone="volt" />
                      <StatTile label="Models active" value={edge?.modelsActive ?? EM} tone="ion" />
                      <StatTile label="Horizon" value={edge?.horizonS ?? EM} unit="s" tone="neutral" />
                      <StatTile label="Samples evaluated" value={(edge?.samplesEvaluated ?? 0).toLocaleString('en-US')} tone="hydro" />
                      <StatTile label="Health" value={AI_TONE[edge?.health ?? 'normal'].label} tone={edge?.health === 'anomaly' ? 'danger' : 'hydro'} />
                      <StatTile label="Free runtime" value="int8 · quantised" tone="neutral" />
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                      Inference runs on the microcontroller inside a bounded memory budget; the platform records the resulting
                      state rather than re-computing it, so what you see is the edge model&apos;s own judgement.
                    </p>
                  </PanelBody>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Panel>
                  <PanelHeader title="SOC inference" />
                  <PanelBody>
                    <SOCChart points={p?.points ?? []} from={range.from} to={range.to} height={210} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Range inference" />
                  <PanelBody>
                    <RangeChart points={p?.points ?? []} from={range.from} to={range.to} height={210} />
                  </PanelBody>
                </Panel>
                <Panel>
                  <PanelHeader title="Anomaly pressure" subtitle={`Threshold ${THRESHOLDS.anomaly.warning.toFixed(2)}`} />
                  <PanelBody>
                    <AnomalyChart points={p?.points ?? []} from={range.from} to={range.to} height={210} />
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