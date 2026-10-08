import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { FOOTER_NAV, PRODUCT } from '@/lib/constants';
import { ArrowUpRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-void-950/60">
      <div className="mx-auto max-w-[1400px] px-5 py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2.4fr]">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark className="h-9 w-9" id="footer" />
              <span className="leading-none">
                <span className="block text-[14px] font-semibold tracking-tight text-ink-50">{PRODUCT.name}</span>
                <span className="mt-1 block text-[9.5px] font-medium uppercase tracking-[0.22em] text-ink-500">{PRODUCT.tagline}</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-[11.5px] leading-relaxed text-ink-400">
              An edge-AI telemetry platform for electric mobility. Instrumentation on an ESP32-S3, telemetry written directly into
              MongoDB Atlas, intelligence rendered for engineers and operators.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip">ESP32-S3 N16R8</span>
              <span className="chip">PZEM-017 ×3</span>
              <span className="chip">DS18B20 ×4</span>
              <span className="chip">MongoDB Atlas</span>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_NAV.map((group) => (
              <div key={group.label}>
                <p className="micro-strong">{group.label}</p>
                <ul className="mt-3 space-y-2">
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group inline-flex items-center gap-1 text-[12px] text-ink-400 transition-colors hover:text-ink-100">
                        {l.label}
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-ink-500">
            © {new Date().getFullYear()} {PRODUCT.company}. {PRODUCT.name} — all telemetry values are read server-side from MongoDB
            Atlas; credentials never reach the browser.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/about" className="text-[11px] text-ink-500 transition-colors hover:text-ink-200">
              About
            </Link>
            <Link href="/technology" className="text-[11px] text-ink-500 transition-colors hover:text-ink-200">
              Technology
            </Link>
            <Link href="/performance" className="text-[11px] text-ink-500 transition-colors hover:text-ink-200">
              Performance
            </Link>
            <Link href="/architecture" className="text-[11px] text-ink-500 transition-colors hover:text-ink-200">
              Architecture
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
