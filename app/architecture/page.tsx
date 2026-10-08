import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Cpu, Database, Network, ShieldCheck, Zap } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Reveal } from '@/components/marketing/Reveal';
import { ArchitectureFacts, SchemaTable, SystemArchitecture } from '@/components/architecture/SystemArchitecture';
import { HARDWARE, PRODUCT, THRESHOLDS } from '@/lib/constants';

export const metadata: Metadata = {
  title: `System Architecture · ${PRODUCT.name}`,
  description:
    'How EVISION AI moves telemetry: PZEM-017 energy meters and DS18B20 probes into an ESP32-S3, edge AI inference on-node, a direct HTTPS write into MongoDB Atlas, and server-side aggregation for the web platform.',
  alternates: { canonical: '/architecture' },
};

const LAYERS = [
  {
    icon: Cpu,
    title: 'Edge instrumentation',
    body: `Three ${HARDWARE.pzemModel} meters daisy-chained on a single UART at addresses 0x01, 0x02 and 0x03, polled by the ${HARDWARE.mcuShort} and timestamped before transmission. Four ${HARDWARE.temperatureSensors} DS18B20 probes run on the 1-Wire bus, sampled in parallel with the power channels.`,
  },
  {
    icon: Zap,
    title: 'Edge computation',
    body: `Each frame is normalised, checked against ${THRESHOLDS.anomaly.warning.toFixed(2)} anomaly floor and passed through ${HARDWARE.aiRuntime.split('(')[0].trim()} for SOC, range and anomaly inference — all inside the microcontroller's memory budget, with no cloud dependency on the safety path.`,
  },
  {
    icon: Network,
    title: 'Direct ingest',
    body: 'The firmware writes the telemetry document straight into the MongoDB Atlas cluster over TLS. Because the write path bypasses the web tier, ingest availability is independent of application deploys and traffic spikes. A MicroSD ring buffer covers connectivity gaps.',
  },
  {
    icon: Database,
    title: 'Server-side resolution',
    body: 'Next.js route handlers read the cluster through a pooled server-side connection, run aggregations and rule evaluation, and return derived JSON. Credentials stay in server-only modules and never reach the browser bundle.',
  },
  {
    icon: ShieldCheck,
    title: 'Operational safety',
    body: 'Every read route is rate limited, schema-validated and cache-free. Telemetry gaps render explicit waiting states, demo data is isolated to its own device id, and thresholds that drive alerts are declared once in a single constants module.',
  },
];

export default function ArchitecturePage() {
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
              <span className="chip">Reference architecture</span>
              <h1 className="mt-6 max-w-3xl text-[34px] leading-[1.05] sm:text-[48px]">
                One microcontroller, one database, one aggregation tier
              </h1>
              <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-ink-300">
                EVISION AI is deliberately small: sensing and inference happen on the vehicle, persistence is a document in
                MongoDB Atlas, and the web platform is a pure read-and-aggregate consumer. Fewer moving parts on the ingest path
                means better uptime and easier forensics.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/dashboard" className="btn-primary">
                  See it with live data
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/technology" className="btn-secondary">
                  Technology reference
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal>
              <SystemArchitecture />
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12">
              <Reveal className="lg:col-span-5">
                <span className="chip">Layers</span>
                <h2 className="mt-5 text-[28px] leading-tight lg:text-[36px]">Five layers, each with one job</h2>
                <p className="mt-5 text-[13px] leading-relaxed text-ink-400">
                  The separation is what keeps the platform honest: instrumentation writes, the edge reasons, the database
                  stores, the server derives and the browser renders. No layer quietly substitutes fabricated values for
                  missing data.
                </p>
              </Reveal>

              <div className="space-y-3 lg:col-span-7">
                {LAYERS.map((l, i) => (
                  <Reveal key={l.title} delay={i}>
                    <div className="panel p-5">
                      <div className="flex items-start gap-3.5">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-volt-300">
                          <l.icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-[10.5px] text-ink-600">0{i + 1}</span>
                            <h3 className="text-[14px] text-ink-50">{l.title}</h3>
                          </div>
                          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">{l.body}</p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="chip">Data model</span>
                  <h2 className="mt-5 text-[26px] leading-tight lg:text-[34px]">Collections and the indexes that serve them</h2>
                </div>
                <p className="max-w-md text-[12.5px] leading-relaxed text-ink-400">
                  Every dashboard range query is backed by one of these indexes, which is why 30-day windows stay responsive on
                  a free Atlas tier.
                </p>
              </div>
              <SchemaTable />
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-24">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal>
              <h2 className="text-[24px] leading-tight lg:text-[32px]">Runtime and deployment facts</h2>
              <div className="mt-8">
                <ArchitectureFacts />
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}