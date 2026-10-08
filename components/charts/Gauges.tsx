'use client';

import { motion, useMotionValue } from 'framer-motion';
import { useEffect } from 'react';
import { cn } from '@/lib/cn';
import { EM, fmt } from '@/lib/format';

const START = -215;
const SWEEP = 250;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function SOCGauge({
  value,
  max = 100,
  size = 208,
  label = 'State of charge',
  unit = '%',
  tone = 'volt',
  thresholds = { low: 25, critical: 12 },
  mode,
}: {
  value: number | null;
  max?: number;
  size?: number;
  label?: string;
  unit?: string;
  tone?: 'volt' | 'ion' | 'hydro' | 'warn' | 'danger';
  thresholds?: { low: number; critical: number };
  mode?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;
  const mv = useMotionValue(0);
  const has = typeof value === 'number' && Number.isFinite(value);

  useEffect(() => {
    mv.set(has ? Math.min(max, Math.max(0, value as number)) : 0);
  }, [value, max, mv, has]);

  const ratio = has ? Math.min(1, Math.max(0, (value as number) / max)) : 0;
  const toneColor =
    tone === 'volt' ? '#3B82F6' : tone === 'ion' ? '#22D3EE' : tone === 'hydro' ? '#34D399' : tone === 'warn' ? '#FBBF24' : '#F87171';
  const state = !has ? 'unknown' : (value as number) <= thresholds.critical ? 'danger' : (value as number) <= thresholds.low ? 'warn' : 'ok';

  const ticks = Array.from({ length: 41 }, (_, i) => i);

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          <linearGradient id={`gauge-${tone}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={toneColor} stopOpacity={0.95} />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity={0.85} />
          </linearGradient>
          <filter id={`gauge-glow-${tone}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={arcPath(cx, cy, r, START, START + SWEEP)} stroke="rgba(255,255,255,0.06)" strokeWidth={12} fill="none" strokeLinecap="round" />
        <path
          d={arcPath(cx, cy, r, START, START + SWEEP)}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1}
          fill="none"
          strokeDasharray="2 7"
        />

        {has ? (
          <>
            <motion.path
              d={arcPath(cx, cy, r, START, START + Math.max(0.6, SWEEP * ratio))}
              stroke={`url(#gauge-${tone})`}
              strokeWidth={12}
              strokeLinecap="round"
              fill="none"
              filter={`url(#gauge-glow-${tone})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.circle
              r={4.5}
              fill="#fff"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                cx: polar(cx, cy, r, START + SWEEP * ratio).x,
                cy: polar(cx, cy, r, START + SWEEP * ratio).y,
              }}
              transition={{ type: 'spring', stiffness: 90, damping: 20 }}
            />
          </>
        ) : null}

        {/* Ticks */}
        {ticks.map((i) => {
          const deg = START + (SWEEP * i) / 40;
          const major = i % 5 === 0;
          const p1 = polar(cx, cy, r + 9, deg);
          const p2 = polar(cx, cy, r + (major ? 16 : 13), deg);
          const passed = has && i / 40 <= ratio;
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={passed ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)'}
              strokeWidth={major ? 1.4 : 0.8}
              opacity={major ? 1 : 0.7}
            />
          );
        })}

        {/* Threshold markers */}
        {has ? (
          <>
            <ThresholdMark cx={cx} cy={cy} r={r} angle={START + SWEEP * (thresholds.low / max)} color="#FBBF24" />
            <ThresholdMark cx={cx} cy={cy} r={r} angle={START + SWEEP * (thresholds.critical / max)} color="#F87171" />
          </>
        ) : null}

        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-ink-50 font-mono" style={{ fontSize: size * 0.19, fontWeight: 600 }}>
          {has ? fmt(value as number, 1, EM) : EM}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="fill-ink-500" style={{ fontSize: size * 0.058, letterSpacing: '0.18em' }}>
          {unit}
        </text>
      </svg>
      <div className="mt-1 text-center">
        <p className="micro">{label}</p>
        {mode ? (
          <p
            className={cn(
              'mt-1 text-[10.5px] font-medium uppercase tracking-[0.16em]',
              state === 'danger' ? 'text-danger-400' : state === 'warn' ? 'text-warn-400' : 'text-ink-400',
            )}
          >
            {mode}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ThresholdMark({ cx, cy, r, angle, color }: { cx: number; cy: number; r: number; angle: number; color: string }) {
  const p1 = polar(cx, cy, r - 8, angle);
  const p2 = polar(cx, cy, r + 8, angle);
  return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.85} />;
}

export function PowerGauge({
  value,
  max = 3000,
  size = 168,
  label = 'Power',
  unit = 'W',
  tone = 'ion',
  bipolar = true,
}: {
  value: number | null;
  max?: number;
  size?: number;
  label?: string;
  unit?: string;
  tone?: 'volt' | 'ion' | 'hydro' | 'sun' | 'warn' | 'danger';
  bipolar?: boolean;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const has = typeof value === 'number' && Number.isFinite(value);
  const clamped = has ? Math.min(max, Math.max(-max, value as number)) : 0;
  const sweep = bipolar ? SWEEP / 2 : SWEEP;
  const start = bipolar ? START : START + SWEEP / 2;
  const ratio = has ? Math.abs(clamped) / max : 0;
  const color = clamped < 0 ? '#34D399' : tone === 'ion' ? '#22D3EE' : tone === 'volt' ? '#3B82F6' : tone === 'warn' ? '#FBBF24' : '#F87171';

  return (
    <div className="inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <path
          d={arcPath(cx, cy, r, start, start + sweep)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
        />
        {has ? (
          <motion.path
            d={arcPath(cx, cy, r, start, start + Math.max(0.8, sweep * ratio))}
            stroke={color}
            strokeWidth={9}
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}
        {bipolar ? (
          <>
            <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
          </>
        ) : null}
        <text x={cx} y={cy + 2} textAnchor="middle" className="fill-ink-50 font-mono" style={{ fontSize: size * 0.155, fontWeight: 600 }}>
          {has ? (Math.abs(clamped) >= 1000 ? `${(Math.abs(clamped) / 1000).toFixed(2)}` : Math.abs(clamped).toFixed(0)) : EM}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" className="fill-ink-500" style={{ fontSize: size * 0.056, letterSpacing: '0.18em' }}>
          {has && Math.abs(clamped) >= 1000 ? 'kW' : unit}
        </text>
      </svg>
      <p className="micro mt-1">{label}</p>
    </div>
  );
}

export function LinearGauge({
  value,
  max = 100,
  label,
  unit,
  tone = 'volt',
  thresholds,
  hint,
}: {
  value: number | null;
  max?: number;
  label: string;
  unit?: string;
  tone?: 'volt' | 'ion' | 'hydro' | 'sun' | 'warn' | 'danger';
  thresholds?: number[];
  hint?: string;
}) {
  const has = typeof value === 'number' && Number.isFinite(value);
  const pct = has ? Math.min(100, Math.max(0, ((value as number) / max) * 100)) : 0;
  const bar: Record<string, string> = {
    volt: 'from-volt-500 to-volt-300',
    ion: 'from-ion-500 to-ion-300',
    hydro: 'from-hydro-500 to-hydro-400',
    sun: 'from-sun-500 to-sun-400',
    warn: 'from-warn-500 to-warn-400',
    danger: 'from-danger-600 to-danger-400',
  };
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="micro">{label}</span>
        <span className="metric text-[15px]">
          {has ? (value as number).toFixed(1) : EM}
          {unit ? <span className="ml-1 text-[10px] text-ink-500">{unit}</span> : null}
        </span>
      </div>
      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', bar[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {thresholds?.map((t) => (
          <span
            key={t}
            className="absolute inset-y-0 w-px bg-white/45"
            style={{ left: `${Math.min(100, (t / max) * 100)}%` }}
          />
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-[10.5px] text-ink-500">{hint}</p> : null}
    </div>
  );
}
