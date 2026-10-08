import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BrainCircuit, Compass, FlaskConical, Rocket, Target, Users } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Reveal } from '@/components/marketing/Reveal';
import { AI_MODELS, HARDWARE, PRODUCT } from '@/lib/constants';

export const metadata: Metadata = {
  title: `About · ${PRODUCT.name}`,
  description:
    `${PRODUCT.name} is an open instrumentation project by ${PRODUCT.company}: turning a solar-assisted, hydrogen-capable electric vehicle into an observable, AI-augmented energy asset.`,
  alternates: { canonical: '/about' },
};

const TIMELINE = [
  {
    icon: Compass,
    phase: 'Phase 01',
    title: 'Instrument the vehicle',
    body: `Three ${HARDWARE.pzemModel} meters and ${HARDWARE.temperatureSensors} DS18B20 probes were mounted across the traction bus, photovoltaic roof, hydrogen stack and battery enclosure to build a trustworthy measurement layer before any intelligence was added.`,
  },
  {
    icon: FlaskConical,
    phase: 'Phase 02',
    title: 'Make it durable',
    body: `The ${HARDWARE.mcuShort} reads every channel, buffers frames to ${HARDWARE.storage} and writes them straight into the Firebase Realtime Database. Ingest no longer depends on a browser, a mobile app or the web tier being online.`,
  },
  {
    icon: BrainCircuit,
    phase: 'Phase 03',
    title: 'Teach the edge',
    body: `${AI_MODELS.map((m) => m.name).join(', ')} run as quantised int8 models on the microcontroller, so state-of-charge judgement, range estimation and fault signatures are produced where the data is measured.`,
  },
  {
    icon: Rocket,
    phase: 'Phase 04',
    title: 'Publish the truth',
    body: 'The web platform derives every chart, gauge and report from the same server-side aggregation, with honest empty states and a labelled demo dataset so the product can be explored without faking measurements.',
  },
];

const VALUES = [
  {
    icon: Target,
    title: 'Measurement before modelling',
    body: 'Inference is only as good as the frame underneath it, so the instrumentation came first and the models second.',
  },
  {
    icon: Users,
    title: 'Legible to operators',
    body: 'Screens are designed for someone diagnosing a vehicle: units are explicit, thresholds are visible and every figure is traceable to a document.',
  },
  {
    icon: FlaskConical,
    title: 'Reproducible',
    body: 'The demo dataset is deterministic and the live path is standard aggregation, so any observation can be re-derived from the database.',
  },
];

export default function AboutPage() {
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
              <span className="chip">About the project</span>
              <h1 className="mt-6 max-w-3xl text-[34px] leading-[1.05] sm:text-[48px]">
                An electric vehicle that explains itself
              </h1>
              <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-ink-300">
                {PRODUCT.name} began as an instrumentation exercise and became a platform. A solar-assisted, hydrogen-capable
                electric vehicle is genuinely hard to reason about: power arrives from two sources, storage buffers it, traction
                spends it, and every one of those flows changes temperature. The project exists to make that behaviour legible —
                first to the operator, then to the model, and finally to you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/vehicle" className="btn-primary">
                  View my car
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/dashboard" className="btn-secondary">
                  Open the dashboard
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <Reveal className="mb-10">
              <span className="chip">How it came together</span>
              <h2 className="mt-5 max-w-2xl text-[28px] leading-tight lg:text-[36px]">Four phases, in the order that actually works</h2>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TIMELINE.map((t, i) => (
                <Reveal key={t.phase} delay={i}>
                  <div className="panel h-full p-6">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-volt-300">
                        <t.icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-600">{t.phase}</span>
                    </div>
                    <h3 className="mt-4 text-[14.5px] text-ink-50">{t.title}</h3>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">{t.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12">
              <Reveal className="lg:col-span-5">
                <span className="chip">Principles</span>
                <h2 className="mt-5 text-[28px] leading-tight lg:text-[36px]">What the platform refuses to do</h2>
                <p className="mt-5 text-[13px] leading-relaxed text-ink-400">
                  A telemetry product earns trust by being dull about its limits. These constraints shaped the architecture more
                  than any feature request.
                </p>
              </Reveal>
              <div className="space-y-3 lg:col-span-7">
                {VALUES.map((v, i) => (
                  <Reveal key={v.title} delay={i}>
                    <div className="panel flex items-start gap-4 p-5">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-ion-300">
                        <v.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-[14px] text-ink-50">{v.title}</h3>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-400">{v.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <Reveal>
              <h2 className="text-[28px] leading-tight lg:text-[40px]">Built to be inspected, not just admired</h2>
              <p className="mx-auto mt-5 max-w-xl text-[13.5px] leading-relaxed text-ink-400">
                Every number on this platform can be traced back to a telemetry document, and every document can be traced back to a
                meter on the vehicle. Start with the architecture, or go straight to the car.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link href="/vehicle" className="btn-primary px-6 py-3">
                  View my car
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/performance" className="btn-secondary px-6 py-3">
                  Performance review
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}