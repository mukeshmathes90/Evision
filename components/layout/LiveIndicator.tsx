'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { LINK_META } from '@/lib/format';
import type { LinkState } from '@/types';

export function LiveIndicator({
  state,
  label,
  className,
  compact = false,
}: {
  state: LinkState;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const meta = LINK_META[state];
  const live = state === 'online';
  const text =
    label ?? (state === 'online' ? 'LIVE' : state === 'delayed' ? 'DELAYED' : state === 'offline' ? 'OFFLINE' : 'NO DATA');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] py-1 pl-2 pr-3',
        compact ? 'text-[10px]' : 'text-[11px]',
        className,
      )}
      role="status"
      aria-live="polite"
      title={
        state === 'offline'
          ? 'No telemetry inside the offline threshold — the device is not reporting.'
          : state === 'delayed'
            ? 'Telemetry is arriving but outside the online window.'
            : 'Telemetry is inside the online window.'
      }
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className={cn('absolute inset-0 rounded-full', meta.tone, live && 'animate-pulse-ring')} />
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', meta.tone)} />
      </span>
      <span className={cn('font-semibold uppercase tracking-[0.18em]', meta.text)}>{text}</span>
    </span>
  );
}

export function PulsingDot({ tone = 'bg-hydro-400', className }: { tone?: string; className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', tone)} />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', tone)} />
    </span>
  );
}

export function StatusDot({ tone = 'bg-hydro-400', pulse = false }: { tone?: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse ? <span className={cn('absolute inset-0 animate-ping rounded-full opacity-50', tone)} /> : null}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', tone)} />
    </span>
  );
}

export function KeyValue({
  label,
  value,
  valueClass,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="micro">{label}</span>
      <span className={cn(mono && 'font-mono tabular-nums', 'text-[12.5px] text-ink-100', valueClass)}>{value}</span>
    </div>
  );
}

export function ConnectionBar({ state, className }: { state: LinkState; className?: string }) {
  const meta = LINK_META[state];
  return (
    <div className={cn('relative h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', meta.tone)}
        initial={{ width: state === 'offline' ? '0%' : '100%' }}
        animate={{ width: state === 'offline' ? '0%' : state === 'delayed' ? '62%' : '100%' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
