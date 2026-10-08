'use client';

import { motion } from 'framer-motion';
import {
  BrainCircuit,
  Cloud,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Radio,
  Server,
  Thermometer,
  Wifi,
  Zap,
} from 'lucide-react';
import { HARDWARE, THRESHOLDS } from '@/lib/constants';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ columns */

const SENSORS = [
  { label: 'PZEM-017 · 0x01', role: 'Solar array', value: 'V / I / P / E', icon: Zap, color: '#FBBF24' },
  { label: 'PZEM-017 · 0x02', role: 'Fuel cell', value: 'V / I / P / E', icon: Zap, color: '#22D3EE' },
  { label: 'PZEM-017 · 0x03', role: 'Vehicle / pack', value: 'V / I / P / E', icon: Zap, color: '#60A5FA' },
  { label: 'DS18B20 ×4', role: 'Thermal probes', value: '12-bit °C', icon: Thermometer, color: '#F87171' },
];

const EDGE = [
  { label: 'Edge AI runtime', detail: HARDWARE.aiRuntime, icon: BrainCircuit, color: '#A78BFA' },
  { label: 'Rule engine', detail: `${THRESHOLDS.anomaly.warning.toFixed(2)} anomaly floor · 7 rules`, icon: Radio, color: '#FBBF24' },
  { label: 'Local buffer', detail: `${HARDWARE.storage} ring buffer`, icon: HardDrive, color: '#60A5FA' },
];

const PLATFORM = [
  { label: 'API routes', detail: 'Aggregate + validate server-side', icon: Server, color: '#3B82F6' },
  { label: 'Firebase RTDB', detail: 'telemetry · devices · layout', icon: Database, color: '#34D399' },
  { label: 'Next.js App Router', detail: 'SSR + live polling + CSV export', icon: Globe, color: '#22D3EE' },
];

export function SystemArchitecture() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-void-950/60 p-5 lg:p-8">
      <div className="pointer-events-none absolute inset-0 grid-dots opacity-[0.22]" />

      <div className="relative grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
        {/* Column 1 — sensing */}
        <Column title="1 · Sense" caption="Physical layer" icon={Cpu} accent="#60A5FA">
          <div className="space-y-2">
            {SENSORS.map((s, i) => (
              <NodeCard key={s.label} delay={i} color={s.color} title={s.label} detail={`${s.role} · ${s.value}`} />
            ))}
          </div>
          <NodeCard delay={4} color="#34D399" title={HARDWARE.pzemProtocol} detail={`1-Wire · ${HARDWARE.temperatureProtocol}`} />
        </Column>

        <Pipe label="UART" color="#60A5FA" />

        {/* Column 2 — edge */}
        <Column title="2 · Infer" caption={`${HARDWARE.mcu} · ${HARDWARE.connectivity}`} icon={BrainCircuit} accent="#A78BFA">
          <div className="space-y-2">
            {EDGE.map((e, i) => (
              <NodeCard key={e.label} delay={i} color={e.color} title={e.label} detail={e.detail} />
            ))}
          </div>
          <NodeCard delay={3} color="#22D3EE" title="Telemetry document" detail="deviceId · timestamp · channels · temperature · ai" />
        </Column>

        <Pipe label="TLS 1.2" color="#22D3EE" />

        {/* Column 3 — platform */}
        <Column title="3 · Resolve" caption="Cloud + web" icon={Cloud} accent="#34D399">
          <div className="space-y-2">
            {PLATFORM.map((p, i) => (
              <NodeCard key={p.label} delay={i} color={p.color} title={p.label} detail={p.detail} />
            ))}
          </div>
          <NodeCard delay={3} color="#FBBF24" title="Browser" detail="JSON payloads only — zero credentials" />
        </Column>
      </div>

      {/* Data path legend */}
      <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4">
        {[
          ['#FBBF24', 'Write path: firmware → Atlas'],
          ['#34D399', 'Read path: Atlas → API → UI'],
          ['#A78BFA', 'Inference: edge only'],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-2 text-[11px] text-ink-400">
            <span className="h-1.5 w-4 rounded-full" style={{ background: c }} />
            {l}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-ink-500">
          <Wifi className="h-3.5 w-3.5" />
          Direct firmware-to-database ingest — no platform proxy in the write path
        </span>
      </div>
    </div>
  );
}

function Column({
  title,
  caption,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  caption: string;
  icon: typeof Cpu;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex rounded-lg border p-1.5" style={{ color: accent, borderColor: `${accent}33`, background: `${accent}12` }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="text-[12px] font-semibold tracking-tight text-ink-50">{title}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">{caption}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NodeCard({ title, detail, color, delay = 0 }: { title: string; detail: string; color: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: delay * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group rounded-xl border border-white/[0.07] bg-white/[0.022] px-3 py-2.5 transition-colors hover:border-white/[0.14]"
    >
      <p className="flex items-center gap-2 text-[11.5px] font-medium text-ink-100">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        {title}
      </p>
      <p className="mt-1 pl-3.5 text-[10.5px] leading-relaxed text-ink-500">{detail}</p>
    </motion.div>
  );
}

function Pipe({ label, color }: { label: string; color: string }) {
  return (
    <div className="relative flex items-center justify-center lg:w-16">
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 64 200" preserveAspectRatio="none" aria-hidden="true">
        {[30, 100, 170].map((y, i) => (
          <motion.circle
            key={y}
            cx="32"
            cy={y}
            r="3"
            fill={color}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0, 1, 0.25] }}
            viewport={{ once: true }}
            transition={{ duration: 2.4, delay: i * 0.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </svg>
      <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.2em] text-ink-600">
        {label}
      </span>
    </div>
  );
}

/** Deployment and runtime facts used on the architecture page. */
export function ArchitectureFacts() {
  const facts = [
    { label: 'Write path', value: 'Firmware → Firebase', detail: 'Direct write from the ESP32-S3; the platform is not in the ingest path.' },
    { label: 'Read path', value: 'Firebase → app', detail: 'Stateless HTTPS reads with a short cache; aggregation happens server-side.' },
    { label: 'Secrets', value: 'Server-only', detail: 'Server modules stay server-only and the public RTDB URL is the only client-visible config; the bundle ships no credentials.' },
    { label: 'Ordering', value: 'deviceId + time', detail: 'Frames are grouped per device and ordered by timestamp, which powers every range query on the platform.' },
    { label: 'Deploy', value: 'Vercel serverless', detail: 'Node runtime, no long-lived connections; connection reuse across warm invocations.' },
    { label: 'Fallback', value: 'Labelled demo dataset', detail: 'Deterministic synthetic frames for a separate demo device, never merged with live data.' },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-3">
      {facts.map((f) => (
        <div key={f.label} className="bg-void-950/80 p-5">
          <p className="micro">{f.label}</p>
          <p className="mt-2 font-mono text-[14px] text-ink-50">{f.value}</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">{f.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function SchemaTable() {
  const rows: [string, string, string][] = [
    ['devices', 'deviceId (unique)', 'Identity, MCU, channel map, last seen'],
    ['telemetry', 'deviceId + timestamp (compound)', 'Per-frame channels, temperature, AI outputs, meta'],
    ['ai_predictions', 'deviceId + timestamp (compound)', 'Model key, confidence, latency, interventions'],
    ['alerts', 'deviceId + status + createdAt', 'Rule hits with severity, threshold and acknowledgement'],
    ['trips', 'deviceId + startTime', 'Distance, SOC delta, efficiency, AI events'],
    ['energy_sessions', 'deviceId + startTime', 'Per-session energy accounting and regeneration'],
    ['system_events', 'deviceId + createdAt', 'Connectivity, firmware and diagnostic events'],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
      <div className="hidden grid-cols-[1fr_1.6fr_2.4fr] gap-4 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3 sm:grid">
        <span className="micro-strong">Collection</span>
        <span className="micro-strong">Key index</span>
        <span className="micro-strong">Purpose</span>
      </div>
      {rows.map(([c, i, p], n) => (
        <div
          key={c}
          className={cn(
            'grid gap-1 px-5 py-3.5 sm:grid-cols-[1fr_1.6fr_2.4fr] sm:gap-4',
            n % 2 === 1 ? 'bg-white/[0.012]' : '',
          )}
        >
          <span className="font-mono text-[12px] text-ink-100">{c}</span>
          <span className="font-mono text-[11.5px] text-ion-300">{i}</span>
          <span className="text-[11.5px] text-ink-400">{p}</span>
        </div>
      ))}
    </div>
  );
}