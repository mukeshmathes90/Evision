'use client';

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLiveData } from '@/hooks/useLiveData';

/**
 * Wraps a server-rendered region with automatic refresh. The child render
 * function receives the freshest payload; nothing is ever fabricated locally.
 */
export function LiveSection<T>({
  url,
  initial,
  intervalMs = 5000,
  enabled = true,
  children,
  showIndicator = false,
  className,
}: {
  url: string;
  initial: T;
  intervalMs?: number;
  enabled?: boolean;
  children: (
    data: T,
    meta: { updatedAt: number | null; refreshing: boolean; error: string | null; refresh: () => void },
  ) => React.ReactNode;
  showIndicator?: boolean;
  className?: string;
}) {
  const { data, updatedAt, refreshing, error, refresh } = useLiveData<T>(url, initial, intervalMs, enabled);
  const payload = data ?? initial;

  return (
    <div className={className}>
      {showIndicator ? (
        <div className="mb-3 flex items-center justify-end gap-3">
          {error ? <span className="font-mono text-[10px] text-danger-400">stream error · showing last good frame</span> : null}
          <span className="font-mono text-[10px] text-ink-600">
            {updatedAt ? `refreshed ${new Date(updatedAt).toISOString().slice(11, 19)} UTC` : 'awaiting first refresh'}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-medium text-ink-300 transition-colors hover:border-white/20 hover:text-ink-100"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      ) : null}
      {children(payload, { updatedAt, refreshing, error, refresh })}
    </div>
  );
}
