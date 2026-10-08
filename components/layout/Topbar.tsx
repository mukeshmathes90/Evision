'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu, Search, Command } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DeviceSelector, type DeviceOption } from './DeviceSelector';
import { LiveIndicator } from './LiveIndicator';
import { NotificationPanel, UserMenu } from './NotificationPanel';
import { Logo } from '@/components/brand/Logo';
import { fmtAgo, fmtDateTime } from '@/lib/format';
import type { AlertRecord, DataSource, LinkState } from '@/types';

export function Topbar({
  devices,
  currentDevice,
  link,
  lastSeen,
  source,
  alerts,
  onOpenMobile,
}: {
  devices: DeviceOption[];
  currentDevice: string;
  link: LinkState;
  lastSeen: string | null;
  source: DataSource;
  alerts: AlertRecord[];
  onOpenMobile: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    next.set('q', query);
    router.push(`/dashboard/data?${next.toString()}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-void-950/85 backdrop-blur-2xl">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-ink-300 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <Link href="/dashboard" className="lg:hidden">
          <Logo compact />
        </Link>

        <div className="hidden items-center gap-2 lg:flex">
          <LiveIndicator state={link} />
          <span className="hidden h-4 w-px bg-white/10 xl:block" />
          <span className="hidden font-mono text-[10.5px] text-ink-500 xl:block">
            {lastSeen ? `${fmtDateTime(lastSeen)} · ${fmtAgo(lastSeen)}` : 'No telemetry received yet'}
          </span>
        </div>

        <form onSubmit={submit} className="ml-auto hidden max-w-md flex-1 md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search telemetry, alerts, trips…"
              aria-label="Search telemetry"
              className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-16 text-[12px] text-ink-100 placeholder:text-ink-600 transition-colors focus:border-volt-500/50"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-ink-600">
              <Command className="h-2.5 w-2.5" />K
            </span>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          <DeviceSelector devices={devices} current={currentDevice} />
          <NotificationPanel alerts={alerts} />
          <UserMenu />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/[0.04] px-4 py-2 lg:hidden">
        <LiveIndicator state={link} compact />
        <span className="truncate font-mono text-[10px] text-ink-500">
          {source === 'demo' ? `${currentDevice} · DEMO` : lastSeen ? fmtAgo(lastSeen) : 'No telemetry'}
        </span>
      </div>
    </header>
  );
}
