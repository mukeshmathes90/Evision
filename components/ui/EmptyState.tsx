'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Database, Radio, WifiOff, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EM } from '@/lib/format';
import type { DataSource, LinkState } from '@/types';

/**
 * Empty-state component. Deliberately never renders a fabricated 0.00 —
 * it explains what the platform is waiting for instead.
 */
export function EmptyState({
  title = 'Waiting for telemetry…',
  description,
  state = 'unknown',
  compact = false,
  action,
}: {
  title?: string;
  description?: string;
  state?: LinkState;
  compact?: boolean;
  action?: ReactNode;
}) {
  const Icon = state === 'offline' ? WifiOff : state === 'online' ? Inbox : Inbox;
  const tone =
    state === 'offline'
      ? 'text-danger-400'
      : state === 'delayed'
        ? 'text-warn-400'
        : 'text-ink-400';
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-6' : 'py-12')}>
      <motion.span
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className={cn('mb-3 inline-flex rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3', tone)}
      >
        <Icon className="h-5 w-5" />
      </motion.span>
      <p className="text-[13px] font-medium text-ink-200">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Prominent, unmissable demo-mode banner. */
export function DataSourceBadge({ source, className }: { source: DataSource; className?: string }) {
  const demo = source === 'demo';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.18em]',
        demo ? 'border-sun-500/40 bg-sun-500/10 text-sun-400' : 'border-hydro-500/35 bg-hydro-500/10 text-hydro-400',
        className,
      )}
      title={demo ? 'Synthetic dataset — EV-DEMO-001' : 'Live telemetry from Firebase'}
    >
      <Database className="h-3 w-3" />
      {demo ? 'DEMO DEVICE' : 'LIVE'}
    </span>
  );
}

export function DemoBanner({ source, deviceId, className }: { source: DataSource; deviceId: string; className?: string }) {
  if (source !== 'demo') return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-sun-500/30 bg-sun-500/[0.07] px-4 py-3',
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.2em] text-sun-400">
        <Radio className="h-3.5 w-3.5 animate-pulse" />
        Demo Mode
      </span>
      <p className="text-[12px] leading-relaxed text-ink-300">
        Showing <span className="font-mono text-ink-100">{deviceId}</span> — a deterministic synthetic fleet rendered from the
        physical model. Values are generated, not measured, and are never merged with real{' '}
        <span className="font-mono text-ink-100">EV-001</span> telemetry.
      </p>
    </motion.div>
  );
}

/** Renders a value or a proper placeholder — never a fake zero. */
export function Value({
  value,
  empty = EM,
  className,
}: {
  value: ReactNode;
  empty?: string;
  className?: string;
}) {
  const missing =
    value === null || value === undefined || value === '' || value === EM || typeof value === 'number' && Number.isNaN(value);
  return <span className={cn(missing && 'text-ink-500', className)}>{missing ? empty : value}</span>;
}
