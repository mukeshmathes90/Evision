'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, ShieldAlert, Thermometer, BatteryLow, Activity, PlugZap, Cpu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { fmtAgo, fmtClock } from '@/lib/format';
import { ALERT_CATEGORY_META, SEVERITY_TONE } from '@/lib/constants';
import type { AlertRecord } from '@/types';

const ICONS: Record<string, typeof Bell> = {
  'high-temperature': Thermometer,
  'low-soc': BatteryLow,
  'high-current': Activity,
  'high-power': PlugZap,
  'abnormal-voltage': PlugZap,
  'comm-failure': Cpu,
  'ai-anomaly': ShieldAlert,
};

export function NotificationPanel({ alerts }: { alerts: AlertRecord[] }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(alerts);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setLocal(alerts), [alerts]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const critical = local.filter((a) => a.severity === 'critical').length;
  const unread = local.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications — ${unread} events`}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-ink-300 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-ink-100"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 font-mono text-[9px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-white/[0.09] bg-void-850/95 shadow-lift backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div>
                <p className="micro-strong">Notifications</p>
                <p className="mt-1 text-[10.5px] text-ink-500">
                  {unread === 0 ? 'No events in window' : `${critical} critical · ${unread} total`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLocal([])}
                  disabled={!local.length}
                  className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white/5 hover:text-ink-200 disabled:opacity-40"
                  aria-label="Mark all read"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white/5 hover:text-ink-200"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {local.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto h-5 w-5 text-ink-600" />
                  <p className="mt-2.5 text-[12px] text-ink-400">Nothing to review</p>
                  <p className="mt-1 text-[10.5px] text-ink-600">The selected window contains no alert events.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {local.slice(0, 14).map((a) => {
                    const IconCmp = ICONS[a.category] ?? Bell;
                    const meta = ALERT_CATEGORY_META[a.category];
                    const tone = SEVERITY_TONE[a.severity];
                    return (
                      <li key={a.id} className="px-4 py-3 transition-colors hover:bg-white/[0.02]">
                        <div className="flex items-start gap-3">
                          <span className={cn('mt-0.5 rounded-lg p-1.5 ring-1', tone.ring, tone.text)}>
                            <IconCmp className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', tone.text)}>
                                {tone.text ? meta.label : a.category}
                              </span>
                              <span className="font-mono text-[9.5px] text-ink-600">{fmtClock(a.timestamp)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-ink-300">{a.message}</p>
                            <p className="mt-1 font-mono text-[9.5px] text-ink-600">
                              {a.source} · {fmtAgo(a.timestamp)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <a
              href="/dashboard/alerts"
              onClick={() => setOpen(false)}
              className="block border-t border-white/[0.06] px-4 py-2.5 text-center text-[11px] font-medium text-volt-300 transition-colors hover:bg-white/[0.03]"
            >
              Open alert centre
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.035] pl-1.5 pr-2.5 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
        aria-label="User profile"
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-volt-500 to-ion-500 text-[10px] font-bold text-white">
          AV
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-[11px] font-medium leading-none text-ink-100">Energy Ops</span>
          <span className="mt-1 block text-[9px] uppercase leading-none tracking-[0.16em] text-ink-500">Administrator</span>
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-white/[0.09] bg-void-850/95 shadow-lift backdrop-blur-2xl"
          >
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="text-[12.5px] font-medium text-ink-50">Energy Operations</p>
              <p className="mt-0.5 text-[10.5px] text-ink-500">ops@evision.ai · Tier 2 access</p>
            </div>
            <div className="p-1.5">
              {[
                { label: 'Dashboard preferences', href: '/dashboard/settings' },
                { label: 'Device registry', href: '/dashboard/device' },
                { label: 'Platform architecture', href: '/architecture' },
                { label: 'Documentation', href: '/technology' },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-[11.5px] text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-ink-100"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="border-t border-white/[0.06] px-4 py-2.5">
              <p className="text-[9.5px] leading-relaxed text-ink-600">
                Session secured server-side. MongoDB credentials are never exposed to this session.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
