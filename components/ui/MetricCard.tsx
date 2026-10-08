'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn, MOTION } from '@/lib/cn';
import { Value } from './EmptyState';

export type MetricTone = 'volt' | 'ion' | 'hydro' | 'sun' | 'danger' | 'warn' | 'neutral';

const TONE_MAP: Record<MetricTone, { icon: string; ring: string; bar: string; text: string }> = {
  volt: { icon: 'text-volt-300', ring: 'ring-volt-500/20', bar: 'from-volt-500 to-volt-300', text: 'text-volt-200' },
  ion: { icon: 'text-ion-300', ring: 'ring-ion-500/20', bar: 'from-ion-500 to-ion-300', text: 'text-ion-300' },
  hydro: { icon: 'text-hydro-400', ring: 'ring-hydro-500/20', bar: 'from-hydro-500 to-hydro-400', text: 'text-hydro-400' },
  sun: { icon: 'text-sun-400', ring: 'ring-sun-500/20', bar: 'from-sun-500 to-sun-400', text: 'text-sun-400' },
  danger: { icon: 'text-danger-400', ring: 'ring-danger-500/20', bar: 'from-danger-600 to-danger-400', text: 'text-danger-400' },
  warn: { icon: 'text-warn-400', ring: 'ring-warn-500/20', bar: 'from-warn-500 to-warn-400', text: 'text-warn-400' },
  neutral: { icon: 'text-ink-300', ring: 'ring-white/10', bar: 'from-ink-500 to-ink-300', text: 'text-ink-200' },
};

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'neutral',
  hint,
  delta,
  deltaLabel,
  footer,
  progress,
  className,
  index = 0,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: LucideIcon;
  tone?: MetricTone;
  hint?: ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  footer?: ReactNode;
  progress?: number | null;
  className?: string;
  index?: number;
  compact?: boolean;
}) {
  const t = TONE_MAP[tone];
  const dir = delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const DeltaIcon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;

  return (
    <motion.article
      variants={MOTION.fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.5, delay: index * 0.04, ease: MOTION.ease }}
      className={cn('panel panel-hover group relative overflow-hidden', className)}
    >
      <div className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-70', t.bar)} />
      <div className={cn('relative', compact ? 'p-4' : 'p-5')}>
        <div className="flex items-start justify-between gap-3">
          <span className="micro">{label}</span>
          {Icon ? (
            <span className={cn('rounded-lg p-1.5 ring-1 transition-colors', t.icon, t.ring, 'bg-white/[0.02]')}>
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className={cn('metric', compact ? 'text-[26px]' : 'text-[30px]')}>
            <Value value={value} />
          </span>
          {unit ? <span className="font-mono text-[11px] font-medium text-ink-400">{unit}</span> : null}
          {delta != null && dir ? (
            <span
              className={cn(
                'ml-auto inline-flex items-center gap-0.5 font-mono text-[10.5px] font-medium',
                dir === 'up' && 'text-hydro-400',
                dir === 'down' && 'text-danger-400',
                dir === 'flat' && 'text-ink-400',
              )}
            >
              <DeltaIcon className="h-3 w-3" />
              {Math.abs(delta).toFixed(1)}
              {deltaLabel}
            </span>
          ) : null}
        </div>

        {progress != null && Number.isFinite(progress) ? (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className={cn('h-full rounded-full bg-gradient-to-r', t.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.9, ease: MOTION.ease }}
            />
          </div>
        ) : null}

        {hint ? <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">{hint}</p> : null}
        {footer ? <div className="mt-3 border-t border-white/[0.06] pt-3">{footer}</div> : null}
      </div>
    </motion.article>
  );
}

export function MetricGrid({ children, className, cols = 4 }: { children: ReactNode; className?: string; cols?: 2 | 3 | 4 | 5 }) {
  const map = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5',
  } as const;
  return <div className={cn('grid grid-cols-1 gap-3 md:gap-4', map[cols], className)}>{children}</div>;
}

/** Compact readout used inside panels (less chrome than MetricCard). */
export function StatTile({
  label,
  value,
  unit,
  tone = 'neutral',
  hint,
  className,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: MetricTone;
  hint?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const t = TONE_MAP[tone];
  return (
    <div className={cn('panel-inset', compact ? 'px-3 py-2.5' : 'px-4 py-3', className)}>
      <div className="flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full', t.bar.split(' ')[1])} />
        <span className="micro">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn('metric', compact ? 'text-[15px]' : 'text-[19px]')}>
          <Value value={value} />
        </span>
        {unit ? <span className="font-mono text-[10px] text-ink-500">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-1 text-[10.5px] leading-relaxed text-ink-500">{hint}</p> : null}
    </div>
  );
}
