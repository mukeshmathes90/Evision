'use client';

import { motion } from 'framer-motion';
import { BellRing, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { SEVERITY_TONE, ALERT_CATEGORY_META } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { fmt, fmtAgo, fmtDateTime } from '@/lib/format';
import type { AlertRecord, AlertSeverity } from '@/types';

const ICONS: Record<AlertSeverity, typeof CircleAlert> = {
  info: Info,
  warning: TriangleAlert,
  critical: CircleAlert,
};

export function AlertCard({ alert, index = 0, dense = false }: { alert: AlertRecord; index?: number; dense?: boolean }) {
  const tone = SEVERITY_TONE[alert.severity];
  const Icon = ICONS[alert.severity];
  const meta = ALERT_CATEGORY_META[alert.category];

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={cn('panel panel-hover relative overflow-hidden', dense ? 'p-3.5' : 'p-4')}
    >
      <span className={cn('absolute inset-y-0 left-0 w-[2px]', tone.dot)} />
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 shrink-0 rounded-lg p-1.5 ring-1', tone.text, tone.ring, 'bg-white/[0.02]')}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-[12.5px] font-semibold', tone.text)}>{meta.label}</span>
            <span className={cn('chip !px-2 !py-0.5', tone.text, tone.ring)}>{alert.severity}</span>
            <span className="font-mono text-[10px] text-ink-600">{alert.id}</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-200">{alert.message}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-ink-500">
            <span>source {alert.source}</span>
            <span>
              value {fmt(alert.value, alert.unit === ' %' ? 1 : 2)} {alert.unit}
            </span>
            <span>
              limit {fmt(alert.threshold, alert.unit === ' %' ? 1 : 2)} {alert.unit}
            </span>
            <span>{fmtDateTime(alert.timestamp)}</span>
            <span>{fmtAgo(alert.timestamp)}</span>
          </div>
        </div>
        <span
          className={cn(
            'hidden shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] sm:inline-flex',
            alert.status === 'active' ? tone.text : 'text-ink-500',
          )}
        >
          {alert.status === 'active' ? <BellRing className="h-3 w-3" /> : <CircleCheck className="h-3 w-3" />}
          {alert.status}
        </span>
      </div>
    </motion.article>
  );
}

export function AlertSummaryStrip({
  summary,
}: {
  summary: { total: number; critical: number; warning: number; info: number; active: number };
}) {
  const cards = [
    { label: 'Total', value: summary.total, tone: 'text-ink-50' },
    { label: 'Active', value: summary.active, tone: 'text-volt-300' },
    { label: 'Critical', value: summary.critical, tone: 'text-danger-400' },
    { label: 'Warning', value: summary.warning, tone: 'text-warn-400' },
    { label: 'Info', value: summary.info, tone: 'text-ion-300' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="panel-inset px-3 py-2.5">
          <p className="micro">{c.label}</p>
          <p className={cn('mt-1.5 font-mono text-[18px] tabular-nums', c.tone)}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}