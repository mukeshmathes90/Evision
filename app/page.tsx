import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BatteryCharging,
  BrainCircuit,
  Cpu,
  Database,
  FileBarChart,
  Flame,
  Gauge,
  LineChart,
  Network,
  Radio,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { PublicNav } from '@/components/layout/PublicNav';
import { HeroTelemetryStrip } from '@/components/marketing/HeroTelemetryStrip';
import { HeroVisualLive } from '@/components/marketing/HeroVisualLive';
import { Reveal } from '@/components/marketing/Reveal';
import { AI_MODELS, HARDWARE, PRODUCT } from '@/lib/constants';
import { activeDeviceId, getOverview } from '@/lib/data';
import { resolveRange } from '@/lib/time-range';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
  description:
    'Real-time energy intelligence for electric mobility. Solar, fuel-cell and battery telemetry from an ESP32-S3 edge node, streamed straight into Firebase Realtime Database and rendered as an interactive vehicle intelligence platform.',
  alternates: { canonical: '/' },
  openGraph: {
    title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    description: 'Instrumented electric mobility telemetry, edge AI and energy intelligence in one platform.',
    type: 'website',
  },
};

const CAPABILITIES = [
  {
    href: '/dashboard/live',
    icon: Radio,
    title: 'Live Vehicle',
    body: 'Second-by-second telemetry from the traction bus, all three PZEM-017 channels and four DS18B20 probes.',
    accent: '#60A5FA',
  },
  {
    href: '/dashboard/energy',
    icon: Zap,
    title: 'Energy Flow',
    body: 'Animated power routing across the PV array, hydrogen stack, 48 V pack and inverter — with per-channel watt-hour accounting.',
    accent: '#FBBF24',
  },
  {
    href: '/dashboard/battery',
    icon: BatteryCharging,
    title: 'Battery Intelligence',
    body: 'State of charge, net pack power, charge mode, cycle count, cell health and derating margins against engineering limits.',
    accent: '#A78BFA',
  },
  {
    href: '/dashboard/ai',
    icon: BrainCircuit,
    title: 'Embedded AI',
    body: 'Three edge models running on the microcontroller — SOC, range and anomaly scoring — with latency and confidence telemetry.',
    accent: '#22D3EE',
  },
  {
    href: '/dashboard/thermal',
    icon: Thermometer,
    title: 'Thermal Envelope',
    body: 'Probe-by-probe temperature map with warm, high and critical bands, excursion history and derating guidance.',
    accent: '#F87171',
  },
  {
    href: '/dashboard/alerts',
    icon: TriangleAlert,
    title: 'Rule Engine',
    body: 'Seven engineering rules evaluated per frame — thermal, SOC, current, power, bus voltage, connectivity and AI anomalies.',
    accent: '#FBBF24',
  },
  {
    href: '/dashboard/analytics',
    icon: LineChart,
    title: 'Analytics',
    body: 'Bucketed history across any window with aggregation, efficiency regression and period-over-period comparison.',
    accent: '#60A5FA',
  },
  {
    href: '/dashboard/reports',
    icon: FileBarChart,
    title: 'Reports',
    body: 'Daily, weekly, monthly, trip, energy-audit, AI and thermal dossiers with CSV export and print-ready layouts.',
    accent: '#34D399',
  },
];

const PIPELINE = [
  {
    icon: Cpu,
    title: 'Sense',
    body: `Three ${HARDWARE.pzemModel} AC/DC energy meters on ${HARDWARE.pzemProtocol}, plus ${HARDWARE.temperatureSensors} 1-Wire probes across the chassis.`,
  },
  {
    icon: Sparkles,
    title: 'Infer',
    body: `${HARDWARE.aiRuntime} runs SOC, range and anomaly inference on the node — no cloud round-trip for safety-relevant judgement.`,
  },
  {
    icon: Network,
    title: 'Stream',
    body: 'Each frame is written straight into the Firebase Realtime Database over TLS. No platform proxy, no polling API between firmware and database.',
  },
  {
    icon: Database,
    title: 'Resolve',
    body: 'Next.js server routes aggregate on the server, so the browser only ever receives derived telemetry — never credentials.',
  },
];

const MATRIX = [
  { label: 'Channel accuracy', value: '±0.5 %', hint: 'PZEM-017 resolution over the 48 V bus' },
  { label: 'Sampling floor', value: '1 Hz', hint: 'Configurable frame cadence from the edge node' },
  { label: 'Edge inference', value: '3 models', hint: 'SOC · range · anomaly detection' },
  { label: 'Storage headroom', value: '16 MB + 8 MB', hint: 'N16R8 flash and PSRAM on the ESP32-S3' },
  { label: 'Transport', value: 'TLS 1.2', hint: 'Wi-Fi with automatic reconnect and backoff' },
  { label: 'Database', value: 'Atlas M0+', hint: 'Time-series indexes on deviceId + timestamp' },
];

export default async function LandingPage() {
  const range = resolveRange('24h');
  const deviceId = activeDeviceId();
  const envelope = await getOverview(deviceId, range);
  const live = envelope.data.latest;

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <PublicNav />

      <main className="pt-16">
        {/* ---------------------------------------------------------------- Hero */}
        <section className="relative">
          <div
            className="pointer-events-none absolute inset-0 grid-fine bg-grid"
            style={{ maskImage: 'radial-gradient(120% 80% at 50% 0%, black, transparent)', WebkitMaskImage: 'radial-gradient(120% 80% at 50% 0%, black, transparent)' }}
          />
          <div className="relative mx-auto max-w-[1400px] px-5 pb-16 pt-16 lg:px-8 lg:pb-24 lg:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <Reveal>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip chip-active">
                      <span className="h-1.5 w-1.5 rounded-full bg-hydro-400" />
                      Live telemetry
                    </span>
                    <span className="chip">{HARDWARE.mcu}</span>
                    <span className="chip">Edge AI</span>
                  </div>
                </Reveal>

                <Reveal delay={1}>
                  <h1 className="mt-7 text-[38px] font-semibold leading-[1.02] tracking-tightest text-ink-50 sm:text-[52px] lg:text-[62px]">
                    Every volt.
                    <br />
                    <span className="text-gradient-accent">Every amp.</span>
                    <br />
                    Every degree — live.
                  </h1>
                </Reveal>

                <Reveal delay={2}>
                  <p className="mt-6 max-w-xl text-[14.5px] leading-relaxed text-ink-300">
                    {PRODUCT.description} Instrumentation sits on an {HARDWARE.mcuShort}, streams directly into the
                    Firebase Realtime Database, and is resolved here into an interactive vehicle, energy-flow schematic and AI
                    telemetry you can act on.
                  </p>
                </Reveal>

                <Reveal delay={3}>
                  <div className="mt-9 flex flex-wrap items-center gap-3">
                    <Link href="/vehicle" className="btn-primary px-6 py-3 text-[13.5px]">
                      View my car
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link href="/dashboard" className="btn-secondary px-6 py-3 text-[13.5px]">
                      Open live dashboard
                      <Gauge className="h-4 w-4" />
                    </Link>
                    <Link href="/architecture" className="btn-ghost px-4 py-3 text-[13.5px]">
                      How it works
                    </Link>
                  </div>
                </Reveal>

                <Reveal delay={4}>
                  <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
                    {[
                      ['3', 'PZEM-017 channels'],
                      ['4', 'DS18B20 probes'],
                      ['3', 'edge AI models'],
                      ['1 Hz', 'telemetry cadence'],
                    ].map(([v, l]) => (
                      <div key={l}>
                        <p className="font-mono text-[17px] tabular-nums text-ink-50">{v}</p>
                        <p className="micro mt-1">{l}</p>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>

              <div className="lg:col-span-6">
                <Reveal delay={2}>
                  <HeroVisualLive initial={{ ok: true, envelope, range }} deviceId={deviceId} />
                </Reveal>
              </div>
            </div>

            <Reveal delay={3}>
              <div className="mt-14 lg:mt-20">
                <HeroTelemetryStrip initial={{ ok: true, envelope, range }} deviceId={deviceId} />
              </div>
            </Reveal>
          </div>
        </section>

        {/* -------------------------------------------------- Interactive vehicle */}
        <section className="relative border-t border-white/[0.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal className="grid gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <span className="chip">Interactive</span>
                <h2 className="mt-5 text-[30px] leading-tight lg:text-[40px]">
                  Tap a component.
                  <br />
                  <span className="text-ink-400">Read its live frame.</span>
                </h2>
                <p className="mt-5 text-[13.5px] leading-relaxed text-ink-400">
                  The vehicle is not an illustration — it is a projection of the newest telemetry document. Selecting the PV
                  array, hydrogen stack, battery, traction motor, thermal probes or the AI core reveals the exact channel values
                  the edge node reported, with animated energy paths tracking real power in each direction.
                </p>
                <ul className="mt-7 space-y-3">
                  {[
                    'Animated flow paths scale speed with live wattage',
                    'Regeneration reverses the direction of the traction path',
                    'Hotspots tint by probe temperature, not by decoration',
                    'Empty collections render an explicit waiting state',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[12.5px] text-ink-300">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hydro-400" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link href="/vehicle" className="btn-outline mt-8">
                  Open the interactive vehicle
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="lg:col-span-7">
                <Reveal delay={1}>
                  <div className="panel relative overflow-hidden p-6 sm:p-10">
                    <div className="pointer-events-none absolute inset-0 grid-dots opacity-[0.25]" />
                    <div className="relative flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="micro">Latest telemetry frame</p>
                        <p className="mt-2 font-mono text-[13px] text-ink-100">{live?.timestamp ?? '— awaiting first frame'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="chip">{envelope.deviceLabel}</span>
                        <span className={`chip ${envelope.link === 'online' ? 'chip-active' : ''}`}>{envelope.link}</span>
                        {envelope.source === 'demo' ? <span className="chip border-sun-500/40 text-sun-400">Demo</span> : null}
                      </div>
                    </div>

                    <div className="relative mt-8 grid gap-3 sm:grid-cols-2">
                      {[
                        { icon: Sun, label: 'PV array', value: live ? `${live.solar.voltage} V · ${live.solar.power} W` : '—', color: '#FBBF24' },
                        { icon: Flame, label: 'Fuel cell', value: live ? `${live.fuelCell.voltage} V · ${live.fuelCell.power} W` : '—', color: '#22D3EE' },
                        { icon: BatteryCharging, label: 'Pack', value: live ? `${live.vehicle.voltage} V · SOC ${envelope.data.ai.soc ?? '—'} %` : '—', color: '#3B82F6' },
                        { icon: Thermometer, label: 'Thermal', value: live ? `${live.temperature.min} → ${live.temperature.max} °C` : '—', color: '#F87171' },
                      ].map((c, i) => (
                        <Reveal key={c.label} delay={i + 1}>
                          <div className="panel-inset flex items-center gap-3 p-4">
                            <span
                              className="rounded-lg border p-2"
                              style={{ color: c.color, borderColor: `${c.color}33`, background: `${c.color}12` }}
                            >
                              <c.icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="micro">{c.label}</p>
                              <p className="mt-1 truncate font-mono text-[12.5px] tabular-nums text-ink-100">{c.value}</p>
                            </div>
                          </div>
                        </Reveal>
                      ))}
                    </div>

                    <div className="relative mt-6 flex items-center justify-between rounded-xl border border-white/[0.07] bg-void-950/60 px-4 py-3">
                      <span className="text-[11.5px] text-ink-400">
                        {envelope.data.counts.telemetry.toLocaleString('en-US')} frames · {envelope.data.counts.alerts} alerts ·{' '}
                        {envelope.data.counts.trips} trips in window
                      </span>
                      <Link href="/dashboard/live" className="text-[11.5px] font-medium text-volt-300 hover:text-volt-200">
                        Live view →
                      </Link>
                    </div>
                  </div>
                </Reveal>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------ Capabilities */}
        <section className="relative border-t border-white/[0.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="chip">Platform</span>
                <h2 className="mt-5 max-w-xl text-[30px] leading-tight lg:text-[40px]">Eight surfaces, one telemetry spine</h2>
              </div>
              <p className="max-w-md text-[13px] leading-relaxed text-ink-400">
                Every page is backed by the same server-side aggregation over the <span className="font-mono">telemetry</span>{' '}
                collection, so numbers reconcile across views and ranges.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITIES.map((c, i) => (
                <Reveal key={c.href} delay={i % 4}>
                  <Link href={c.href} className="panel panel-hover group flex h-full flex-col p-5">
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105"
                      style={{ color: c.accent, borderColor: `${c.accent}33`, background: `${c.accent}12` }}
                    >
                      <c.icon className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 text-[14px] text-ink-50">{c.title}</h3>
                    <p className="mt-2 flex-1 text-[12px] leading-relaxed text-ink-400">{c.body}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-300 transition-colors group-hover:text-ink-50">
                      Open
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ Pipeline */}
        <section className="relative border-t border-white/[0.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal className="max-w-2xl">
              <span className="chip">Edge to cloud</span>
              <h2 className="mt-5 text-[30px] leading-tight lg:text-[40px]">
                From a UART frame to a rendered chart in one hop
              </h2>
              <p className="mt-5 text-[13.5px] leading-relaxed text-ink-400">
                The firmware writes telemetry directly into Firebase Realtime Database. The website only reads and aggregates, which keeps
                the write path independent of application availability and removes a whole class of ingest bottleneck.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((s, i) => (
                <Reveal key={s.title} delay={i}>
                  <div className="panel h-full p-5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-ink-600">0{i + 1}</span>
                      <s.icon className="h-4 w-4 text-volt-300" />
                    </div>
                    <h3 className="mt-4 text-[14px] text-ink-50">{s.title}</h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-400">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={2}>
              <div className="panel mt-4 overflow-hidden p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  {['ESP32-S3', 'PZEM ×3', 'DS18B20 ×4', 'MicroSD', 'Wi-Fi + TLS', 'Firebase RTDB', 'Next.js'].map((n) => (
                    <span key={n} className="chip">
                      {n}
                    </span>
                  ))}
                </div>
                <pre className="mt-6 overflow-x-auto rounded-xl border border-white/[0.07] bg-void-950/80 p-5 font-mono text-[11.5px] leading-relaxed text-ink-300">
{`ESP32-S3  ── UART Modbus-RTU ──▶  PZEM-017 (0x01 solar · 0x02 fuel cell · 0x03 load)
    │                                     │
    ├── 1-Wire ──▶ DS18B20 ×4             │  V / I / P / E
    │                                     ▼
    ├── edge AI ──▶ SOC · range · anomaly (TFLite Micro)
    │
    └───────────── HTTPS insert ──────────▶  Atlas: telemetry
                                                   │
                          Next.js server routes ──┘ (aggregate, never expose)
                                                   ▼
                                          React + Recharts + Framer Motion`}
                </pre>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------------- Edge AI */}
        <section className="relative border-t border-white/[0.06] py-20 lg:py-28">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="chip">AI-MODEL · {AI_MODELS.length}</span>
                <h2 className="mt-5 max-w-xl text-[30px] leading-tight lg:text-[40px]">Inference at the edge, telemetry at the centre</h2>
              </div>
              <p className="max-w-md text-[13px] leading-relaxed text-ink-400">
                Models execute on the microcontroller inside a bounded memory budget. The platform records their latency,
                confidence and interventions so model behaviour is observable rather than assumed.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {AI_MODELS.map((m, i) => (
                <Reveal key={m.key} delay={i}>
                  <div className="panel relative h-full overflow-hidden p-6">
                    <div className="absolute right-4 top-4 font-mono text-[42px] leading-none text-white/[0.04]">{m.index}</div>
                    <span className="chip">AI-MODEL-{m.index}</span>
                    <h3 className="mt-4 text-[16px] text-ink-50">{m.name}</h3>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-500">{m.short}</p>
                    <p className="mt-4 text-[12.5px] leading-relaxed text-ink-400">{m.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------------- Matrix */}
        <section className="relative border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12">
              <Reveal className="lg:col-span-4">
                <span className="chip">Reference build</span>
                <h2 className="mt-5 text-[28px] leading-tight lg:text-[36px]">Engineering constants, not marketing numbers</h2>
                <p className="mt-5 text-[13px] leading-relaxed text-ink-400">
                  The instrumentation, thresholds and transport properties of the reference vehicle. Detailed derivations live on
                  the technology and architecture pages.
                </p>
                <Link href="/technology" className="btn-secondary mt-7">
                  Technology reference
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Reveal>

              <Reveal delay={1} className="lg:col-span-8">
                <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-3">
                  {MATRIX.map((m) => (
                    <div key={m.label} className="bg-void-950/80 p-5">
                      <p className="micro">{m.label}</p>
                      <p className="mt-2.5 font-mono text-[22px] tabular-nums text-ink-50">{m.value}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{m.hint}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------------- CTA */}
        <section className="relative overflow-hidden border-t border-white/[0.06] py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_0%,rgba(37,99,235,0.20),transparent_65%)]" />
          <Reveal className="relative mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="text-[32px] leading-tight lg:text-[46px]">Open the vehicle. Watch the physics.</h2>
            <p className="mx-auto mt-5 max-w-xl text-[13.5px] leading-relaxed text-ink-400">
              Every tile, gauge and curve on this platform is derived from the telemetry collection. Nothing is mocked in the
              product experience — the demo dataset is opt-in, isolated and always labelled.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/vehicle" className="btn-primary px-7 py-3.5 text-[14px]">
                View my car
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard" className="btn-secondary px-7 py-3.5 text-[14px]">
                Open dashboard
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}