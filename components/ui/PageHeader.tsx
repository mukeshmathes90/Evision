'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, MOTION } from '@/lib/cn';
import type { DataSource } from '@/types';
import { DataSourceBadge, DemoBanner } from './EmptyState';

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  source,
  deviceId,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  source?: DataSource;
  deviceId?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: MOTION.ease }}
      className={cn('mb-5', className)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              {Icon ? (
                <span className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.035] p-1.5 text-volt-300">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ) : null}
              <span className="micro-strong">{eyebrow}</span>
              {source && deviceId ? <DataSourceBadge source={source} /> : null}
            </div>
          ) : null}
          <h1 className="display text-[26px] sm:text-[32px]">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-ink-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {source && deviceId ? <DemoBanner source={source} deviceId={deviceId} className="mt-4" /> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </motion.header>
  );
}
