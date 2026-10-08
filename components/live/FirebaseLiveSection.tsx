'use client';

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFirebaseLive } from '@/hooks/useFirebaseLive';
import type { ApiEnvelope, LivePayload, TimeRange } from '@/types';

/**
 * Wraps the live vehicle view with a direct browser↔Firebase subscription.
 * The child render function receives the freshest payload built from Firebase
 * Realtime Database frames; nothing is ever fabricated locally.
 */
export function FirebaseLiveSection({
  initial,
  deviceId,
  range,
  enabled = true,
  children,
  showIndicator = false,
  className,
}: {
  initial: ApiEnvelope<LivePayload>;
  deviceId: string;
  range: TimeRange;
  enabled?: boolean;
  children: (
    data: ApiEnvelope<LivePayload>,
    meta: { updatedAt: number | null; refreshing: boolean; error: string | null; refresh: () => void },
  ) => React.ReactNode;
  showIndicator?: boolean;
  className?: string;
}) {
  const { payload, updatedAt, refreshing, error, refresh } = useFirebaseLive(deviceId, range, initial, enabled);

  return (
    <div className={className}>
      {showIndicator ? (
        <div className="mb-3 flex items-center justify-end gap-3">
          {error ? <span className="font-mono text-[10px] text-danger-400">firebase stream error · showing last good frame</span> : null}
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