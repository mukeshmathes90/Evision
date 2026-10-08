'use client';

import type { ReactNode } from 'react';
import { makeTimeFormatter } from '@/lib/time-range';

export interface AxisSpec {
  dataKey: string;
  label?: string;
  color?: string;
  unit?: string;
  area?: boolean;
  dashed?: boolean;
  hideInTooltip?: boolean;
}

export function ChartTooltip({
  active,
  payload,
  label,
  unitByKey,
  labelFormatter,
  mode = 'abs',
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; name?: string | number; value?: number | string; color?: string; dataIndex?: number }[];
  label?: number | string;
  unitByKey?: Record<string, string>;
  labelFormatter?: (v: number) => string;
  mode?: 'abs' | 'signed';
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => !unitByKey || unitByKey[String(p.dataKey)] !== undefined || p.value != null);
  return (
    <div className="pointer-events-none min-w-[168px] rounded-xl border border-white/[0.1] bg-void-900/95 px-3 py-2.5 shadow-lift backdrop-blur-xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
        {labelFormatter && typeof label === 'number' ? labelFormatter(label) : String(label ?? '')}
      </p>
      <ul className="mt-2 space-y-1">
        {rows.map((p, i) => {
          const key = String(p.dataKey ?? i);
          const unit = unitByKey?.[key] ?? '';
          const v = typeof p.value === 'number' ? p.value : Number(p.value ?? 0);
          const shown = mode === 'abs' ? Math.abs(v).toFixed(unit === ' %' ? 1 : unit === ' kWh' ? 2 : 1) : v.toFixed(1);
          return (
            <li key={`${key}-${i}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                <span className="text-[10.5px] text-ink-400">{p.name ?? key}</span>
              </span>
              <span className="font-mono text-[11px] tabular-nums text-ink-100">
                {shown}
                <span className="text-ink-500">{unit}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[10.5px] text-ink-400">
          <span
            className="h-[2px] w-4 rounded-full"
            style={{
              background: i.dashed
                ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)`
                : i.color,
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function timeFormatterFor(from: number, to: number) {
  return makeTimeFormatter(from, to);
}

export function ChartFrame({
  children,
  height = 260,
  from,
  to,
}: {
  children: (fmtTime: (t: number) => string) => ReactNode;
  height?: number;
  from: number;
  to: number;
  unitByKey?: Record<string, string>;
  mode?: 'abs' | 'signed';
  yWidth?: number;
}) {
  const fmt = timeFormatterFor(from, to);
  return (
    <div style={{ height }} className="w-full">
      {children(fmt)}
    </div>
  );
}

export const AXIS_PROPS = {
  stroke: 'transparent',
  tickLine: false,
  axisLine: false,
  minTickGap: 26,
} as const;

export const GRID_PROPS = {
  strokeDasharray: '2 6',
  vertical: false,
} as const;
