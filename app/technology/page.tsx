import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  Cpu,
  Database,
  HardDrive,
  LineChart,
  Monitor,
  Radio,
  Thermometer,
  Wifi,
  Zap,
} from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Reveal } from '@/components/marketing/Reveal';
import { AI_MODELS, HARDWARE, PRODUCT, THRESHOLDS } from '@/lib/constants';

export const metadata: Metadata = {
  title: `Technology · ${PRODUCT.name}`,
  description:
    'Instrumentation, protocols, edge AI runtime and web stack behind EVISION AI: PZEM-017 Modbus-RTU channels, DS18B20 thermal sensing, TFLite Micro inference on ESP32-S3 and a MongoDB Atlas time-series backbone.',
  alternates: { canonical: '/technology' },
};

const STACK = [
  {
    icon: Cpu,
    title: 'Compute',
    items: [
      `${HARDWARE.mcu} — dual-core Xtensa LX7, 512 KB SRAM, 16 MB flash, 8 MB PSRAM`,
      'FreeRTOS tasks for UART polling, 1-Wire sampling, inference and transport',
      'Hardware watchdog plus brown-out aware power management',
    ],
  },
  {
    icon: Zap,
    title: 'Energy metering',
    items: [
      `${HARDWARE.pzemCount} × ${HARDWARE.pzemModel} — voltage, current, power, cumulative energy`,
      HARDWARE.pzemProtocol,
      `48 V nominal traction bus across a ${HARDWARE.busVoltage}-cell pack`,
    ],
  },
  {
    icon: Thermometer,
    title: 'Thermal sensing',
    items: [
      `${HARDWARE.temperatureSensors} × DS18B20 — 12-bit resolution, ±0.5 °C accuracy`,
      HARDWARE.temperatureProtocol,
      'Zones: PV roof, fuel-cell stack, inverter/motor, battery enclosure',
    ],
  },
  {
    icon: Radio,
    title: 'Transport',
    items: [
      HARDWARE.connectivity,
      'Automatic reconnect with exponential backoff and jitter',
      `${HARDWARE.storage} ring buffer replays unsent frames after an outage`,
    ],
  },
  {
    icon: BrainCircuit,
    title: 'Edge AI',
    items: [
      HARDWARE.aiRuntime,
      'Quantised int8 weights sized for the SRAM budget',
      `${AI_MODELS.length} models evaluated per frame with latency telemetry`,
    ],
  },
  {
    icon: Database,
    title: 'Persistence',
    items: [
      'MongoDB Atlas cluster, direct firmware insert into `telemetry`',
      'Compound `{ deviceId, timestamp }` index on every time-series collection',
      'Server-side aggregation with a pooled Mongoose connection',
    ],
  },
  {
    icon: LineChart,
    title: 'Web stack',
    items: [
      'Next.js App Router with React Server Components',
      'TypeScript in strict mode, Tailwind design system',
      'Recharts for series, Framer Motion for choreography, Lucide for iconography',
    ],
  },
  {
    icon: Monitor,
    title: 'Experience',
    items: [
      'Live polling with explicit waiting states instead of fabricated zeroes',
      'Deterministic, labelled demo dataset on a separate device id',
      'CSV export, print-ready reports, responsive down to 360 px',
    ],
  },
];

export default function TechnologyPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <PublicNav />
      <main className="pt-16">
        <section className="relative">
          <div
            className="pointer-events-none absolute inset-0 grid-fine bg-grid"
            style={{ maskImage: 'radial-gradient(110% 70% at 50% 0%, black, transparent)', WebkitMaskImage: 'radial-gradient(110% 70% at 50% 0%, black, transparent)' }}
          />
          <div className="relative mx-auto max-w-[1400px] px-5 pb-14 pt-16 lg:px-8 lg:pt-24">
            <Reveal>
              <span className="chip">Technology</span>
              <h1 className="mt-6 max-w-3xl text-[34px] leading-[1.05] sm:text-[48px]">The whole stack, on the record</h1>
              <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-ink-300">
                No abstractions are hidden here. This is the actual hardware, the actual protocols, the actual runtime and the
                actual web stack used to turn an electric vehicle into a live telemetry source.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {STACK.map((s, i) => (
                <Reveal key={s.title} delay={i % 2}>
                  <div className="panel h-full p-6">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-volt-300">
                        <s.icon className="h-4 w-4" />
                      </span>
                      <h2 className="text-[15px] text-ink-50">{s.title}</h2>
                    </div>
                    <ul className="mt-4 space-y-2.5">
                      {s.items.map((it) => (
                        <li key={it} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-400">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-500" />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Sensor address map */}
        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12">
              <Reveal className="lg:col-span-5">
                <span className="chip">Wiring</span>
                <h2 className="mt-5 text-[28px] leading-tight lg:text-[36px]">One UART, three addresses</h2>
                <p className="mt-5 text-[13px] leading-relaxed text-ink-400">
                  All three energy meters share a single UART bus with TTL levels. The node addresses each meter in turn, so
                  channel identity survives all the way into the telemetry document and never depends on UI state.
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {['Modbus-RTU', 'UART', '1-Wire', 'SPI', 'Wi-Fi', 'TLS 1.2'].map((p) => (
                    <span key={p} className="chip">
                      {p}
                    </span>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={1} className="lg:col-span-7">
                <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                  <div className="hidden grid-cols-[0.7fr_0.9fr_1.4fr] gap-4 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3 sm:grid">
                    <span className="micro-strong">Address</span>
                    <span className="micro-strong">Meter</span>
                    <span className="micro-strong">Role in the platform</span>
                  </div>
                  {HARDWARE.protocolAddressMap.map((m, i) => (
                    <div
                      key={m.address}
                      className={`grid gap-1 px-5 py-4 sm:grid-cols-[0.7fr_0.9fr_1.4fr] sm:gap-4 ${i % 2 === 1 ? 'bg-white/[0.012]' : ''}`}
                    >
                      <span className="font-mono text-[12.5px] text-ion-300">{m.address}</span>
                      <span className="font-mono text-[12px] text-ink-100">{HARDWARE.pzemModel}</span>
                      <span className="text-[12px] text-ink-400">
                        {m.role === 'SOLAR'
                          ? 'Photovoltaic array generation and yield tracking'
                          : m.role === 'FUEL_CELL'
                            ? 'Hydrogen stack output, ramp and degradation tracking'
                            : 'Traction bus, pack throughput and regenerative recovery'}
                      </span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Thresholds */}
        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="chip">Rule set</span>
                <h2 className="mt-5 text-[28px] leading-tight lg:text-[36px]">Thresholds that drive every alert</h2>
              </div>
              <p className="max-w-md text-[12.5px] leading-relaxed text-ink-400">
                Declared once in a single module and consumed by the dashboard, the alerting view and the report generator, so a
                limit is never silently different between screens.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['SOC reserve', `${THRESHOLDS.socLow} %`, 'warning below'],
                ['SOC critical', `${THRESHOLDS.socCritical} %`, 'intervention'],
                ['Bus low', `${THRESHOLDS.batteryVoltageLow} V`, 'brown-out risk'],
                ['Bus high', `${THRESHOLDS.batteryVoltageHigh} V`, 'over-voltage'],
                ['Continuous power', `${(THRESHOLDS.vehiclePowerHigh / 1000).toFixed(1)} kW`, 'traction ceiling'],
                ['Continuous current', `${THRESHOLDS.vehicleCurrentHigh} A`, 'contactor limit'],
                ['Thermal warm', `${THRESHOLDS.thermal.warm} °C`, 'monitor'],
                ['Thermal critical', `${THRESHOLDS.thermal.critical} °C`, 'derate'],
                ['AI warning floor', THRESHOLDS.anomaly.warning.toFixed(2), 'anomaly score'],
                ['AI critical floor', THRESHOLDS.anomaly.critical.toFixed(2), 'anomaly score'],
                ['Solar rated', `${(THRESHOLDS.solarPowerNominal / 1000).toFixed(1)} kWp`, 'array nominal'],
                ['Stack rated', `${(THRESHOLDS.fuelCellPowerNominal / 1000).toFixed(1)} kW`, 'stack nominal'],
              ].map(([label, value, hint], i) => (
                <div key={label} className={`bg-void-950/80 p-5 ${i % 2 === 1 ? '' : ''}`}>
                  <p className="micro">{label}</p>
                  <p className="mt-2 font-mono text-[20px] tabular-nums text-ink-50">{value}</p>
                  <p className="mt-1.5 text-[10.5px] text-ink-500">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Deployed stack */}
        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal>
              <div className="panel flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-4 w-4 text-ion-300" />
                    <h2 className="text-[18px] text-ink-50">Deployment shape</h2>
                  </div>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
                    The web tier runs on Vercel with the Node runtime. Mongoose keeps a single pooled connection alive across warm
                    invocations, database credentials are read from environment variables inside server-only modules, and the
                    firmware never needs the platform to be reachable in order to ingest data.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Vercel Edge Network', 'Node 20 Runtime', 'MongoDB Atlas M0+', 'TLS 1.2 Ingest', 'No client secrets'].map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/architecture" className="btn-primary">
                  Architecture reference
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/dashboard" className="btn-secondary">
                  Open the dashboard
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-3 px-5 text-[11.5px] text-ink-500 lg:px-8">
            <Wifi className="h-3.5 w-3.5" />
            <span>Wireless transport with local buffering</span>
            <span className="text-ink-700">·</span>
            <Cpu className="h-3.5 w-3.5" />
            <span>Deterministic edge inference</span>
            <span className="text-ink-700">·</span>
            <Database className="h-3.5 w-3.5" />
            <span>Server-side aggregation</span>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}