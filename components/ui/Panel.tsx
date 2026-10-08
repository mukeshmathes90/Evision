'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/cn';

export function Panel({
  children,
  className,
  hover = false,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={cn('panel', hover && 'panel-hover', className)}>{children}</Tag>;
}

/**
 * lucide-react >= 0.45x exports icons as `{ $$typeof, render }` objects rather
 * than functions, so a `typeof icon === 'function'` guard no longer detects
 * them. Treat any object carrying a React `$$typeof` marker but no element
 * `type` (i.e. forwardRef-style component types, not JSX elements) as an icon.
 */
function isIconComponent(value: unknown): value is LucideIcon {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value && !('type' in value))
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
  className,
  dense = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Either a Lucide icon component or an arbitrary node. */
  icon?: LucideIcon | ReactNode;
  action?: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  const Icon = isIconComponent(icon) ? (icon as LucideIcon) : null;
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 border-b border-white/[0.06]',
        dense ? 'px-4 py-3' : 'px-5 py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-volt-300" />
        ) : icon ? (
          <span className="mt-0.5 shrink-0 text-volt-300">{icon as ReactNode}</span>
        ) : null}
        <div className="min-w-0">
          <h3 className={cn('truncate font-semibold tracking-tight text-ink-50', dense ? 'text-[13px]' : 'text-[15px]')}>
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 truncate text-[11px] leading-relaxed text-ink-400">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PanelBody({ children, className, dense = false }: { children: ReactNode; className?: string; dense?: boolean }) {
  return <div className={cn(dense ? 'p-4' : 'p-5', className)}>{children}</div>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="micro-strong">{children}</span>
      <span className="hairline flex-1" />
    </div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={MOTION.fadeUp} transition={{ duration: 0.5, ease: MOTION.ease }}>
      {children}
    </motion.div>
  );
}
