'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, Cpu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export interface DeviceOption {
  deviceId: string;
  name: string;
  source: 'live' | 'demo';
  status: string;
  location: string;
  lastSeen: string | null;
}

/**
 * Device selector. Selection is stored in the URL (`?device=`) so that every
 * server-rendered page and every API call agree on which node is being viewed
 * without any client-side global state.
 */
export function DeviceSelector({ devices, current }: { devices: DeviceOption[]; current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const active = devices.find((d) => d.deviceId === current) ?? devices[0];

  const choose = (deviceId: string) => {
    setOpen(false);
    const next = new URLSearchParams(params.toString());
    next.set('device', deviceId);
    router.push(`${pathname}?${next.toString()}`);
    router.refresh();
  };

  const statusTone: Record<string, string> = {
    online: 'bg-hydro-400',
    delayed: 'bg-warn-400',
    offline: 'bg-danger-400',
    unknown: 'bg-ink-500',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Cpu className="h-3.5 w-3.5 text-volt-300" />
        <span className="hidden text-left sm:block">
          <span className="block font-mono text-[11.5px] font-medium leading-none text-ink-100">
            {active?.deviceId ?? current}
          </span>
          <span className="mt-1 block text-[9px] uppercase leading-none tracking-[0.16em] text-ink-500">
            {active?.source === 'demo' ? 'Demo device' : 'Live device'}
          </span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-500 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/[0.09] bg-void-850/95 shadow-lift backdrop-blur-2xl"
            role="listbox"
          >
            <div className="border-b border-white/[0.06] px-4 py-2.5">
              <p className="micro-strong">Device selector</p>
              <p className="mt-1 text-[10.5px] text-ink-500">Demo and live nodes are never merged.</p>
            </div>
            <ul className="max-h-80 overflow-y-auto py-1.5">
              {devices.map((d) => {
                const selected = d.deviceId === current;
                return (
                  <li key={d.deviceId}>
                    <button
                      type="button"
                      onClick={() => choose(d.deviceId)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
                        selected ? 'bg-white/[0.055]' : 'hover:bg-white/[0.03]',
                      )}
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', statusTone[d.status] ?? 'bg-ink-500')} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[11.5px] font-medium text-ink-100">{d.deviceId}</span>
                          {d.source === 'demo' ? (
                            <span className="rounded border border-sun-500/35 bg-sun-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] text-sun-400">
                              Demo
                            </span>
                          ) : null}
                          {selected ? <Check className="ml-auto h-3.5 w-3.5 text-volt-300" /> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-ink-400">{d.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-ink-600">{d.location}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
