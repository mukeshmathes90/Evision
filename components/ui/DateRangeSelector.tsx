'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { CalendarRange } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { RANGE_PRESETS, resolveRange } from '@/lib/time-range';

export function DateRangeSelector({
  defaultKey = '24h',
  paramName = 'range',
  includeDaily = false,
  onChange,
  showCustom = true,
  className,
}: {
  defaultKey?: string;
  paramName?: string;
  includeDaily?: boolean;
  onChange?: (payload: { key: string; label: string; from: number; to: number }) => void;
  showCustom?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get(paramName) ?? defaultKey;
  const [key, setKey] = useState(initial);
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 16));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));

  const daily = useMemo(
    () => [
      { key: 'daily', label: 'DAILY' },
      { key: 'weekly', label: 'WEEKLY' },
      { key: 'monthly', label: 'MONTHLY' },
    ],
    [],
  );

  const select = (next: string) => {
    setKey(next);
    setCustomOpen(next === 'custom');
    const sp = new URLSearchParams(params.toString());
    sp.set(paramName, next);
    router.replace(`${pathname}?${sp.toString()}`);
    const resolved = next === 'custom' ? resolveRange('custom', Date.parse(from), Date.parse(to)) : resolveRange(next);
    onChange?.(resolved);
  };

  const applyCustom = () => {
    const f = Date.parse(from);
    const t = Date.parse(to);
    if (!Number.isFinite(f) || !Number.isFinite(t) || t <= f) return;
    setKey('custom');
    const sp = new URLSearchParams(params.toString());
    sp.set(paramName, 'custom');
    sp.set('from', String(f));
    sp.set('to', String(t));
    router.replace(`${pathname}?${sp.toString()}`);
    onChange?.(resolveRange('custom', f, t));
  };

  const options = includeDaily ? [...daily, ...RANGE_PRESETS.map((p) => ({ key: p.key, label: p.label }))] : RANGE_PRESETS.map((p) => ({ key: p.key, label: p.label }));

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => select(o.key)}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-all duration-200',
              key === o.key
                ? 'bg-volt-600/90 text-white shadow-lift'
                : 'text-ink-400 hover:bg-white/[0.05] hover:text-ink-200',
            )}
          >
            {o.label}
          </button>
        ))}
        {showCustom ? (
          <button
            type="button"
            onClick={() => {
              setKey('custom');
              setCustomOpen((v) => !v);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-all',
              key === 'custom' ? 'bg-volt-600/90 text-white shadow-lift' : 'text-ink-400 hover:bg-white/[0.05] hover:text-ink-200',
            )}
          >
            <CalendarRange className="h-3 w-3" />
            Custom
          </button>
        ) : null}
      </div>

      {showCustom && customOpen ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-2.5">
          <label className="flex flex-col gap-1">
            <span className="micro">From</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 font-mono text-[11px] text-ink-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="micro">To</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 font-mono text-[11px] text-ink-100"
            />
          </label>
          <button type="button" onClick={applyCustom} className="btn-primary !px-3 !py-2 !text-[11px]">
            Apply window
          </button>
        </div>
      ) : null}
    </div>
  );
}
