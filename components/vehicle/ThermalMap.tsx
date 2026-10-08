'use client';

import { motion } from 'framer-motion';
import { EM, fmt, thermalColor } from '@/lib/format';
import { THERMAL_TONE } from '@/lib/constants';
import { THRESHOLDS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { ThermalCell, ThermalReport } from '@/types';

const STATUS_DOT: Record<ThermalReport['status'], string> = {
  normal: '#34D399',
  warm: '#34D3EE',
  high: '#FBBF24',
  critical: '#F87171',
};

/** Top-down thermal map of the vehicle, tinted by the DS18B20 probe readings. */
export function ThermalMap({ cells, status }: { cells: ThermalCell[]; status: ThermalReport['status'] }) {
  const tone = THERMAL_TONE[status];
  const temps = cells.map((c) => c.tempC).filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 0;

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#05080E] p-3">
        <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
        <svg viewBox="0 0 100 100" className="relative z-10 w-full" role="img" aria-label="Vehicle thermal map">
          {/* Vehicle silhouette (top-down) */}
          <path
            d="M28 6 C24 6 21 10 21 16 L19 40 C18 52 17 62 19 76 C20 88 23 94 28 94 L72 94 C77 94 80 88 81 76 C83 62 82 52 81 40 L79 16 C79 10 76 6 72 6 Z"
            fill="rgba(255,255,255,0.015)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="0.7"
          />
          <rect x="41" y="20" width="18" height="20" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <text x="50" y="17" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 2.6, letterSpacing: '0.1em' }}>
            PV ROOF
          </text>
          <rect x="26" y="80" width="48" height="10" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <text x="50" y="86.5" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 3, letterSpacing: '0.1em' }}>
            BATTERY ENCLOSURE
          </text>
          <circle cx="34" cy="72" r="5.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
          <circle cx="66" cy="72" r="5.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
          <text x="34" y="73.2" textAnchor="middle" className="fill-ink-600" style={{ fontSize: 3 }}>
            M
          </text>
          <text x="66" y="73.2" textAnchor="middle" className="fill-ink-600" style={{ fontSize: 3 }}>
            M
          </text>

          {cells.map((c, i) => {
            const has = Number.isFinite(c.tempC);
            const color = has ? thermalColor(c.tempC, Math.min(20, min - 4), Math.max(50, max + 6)) : '#334155';
            return (
              <motion.g
                key={c.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                style={{ transformOrigin: `${c.x + c.w / 2}px ${c.y + c.h / 2}px` }}
              >
                <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="2.4" fill={color} fillOpacity="0.24" stroke={color} strokeWidth="0.6" />
                <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="2.4" fill="url(#thermalGlow)" opacity="0.28" />
                <text x={c.x + c.w / 2} y={c.y + c.h / 2 - 0.4} textAnchor="middle" className="fill-ink-50 font-mono" style={{ fontSize: 3.4, fontWeight: 600 }}>
                  {has ? fmt(c.tempC, 1, EM) : EM}
                </text>
                <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 3.4} textAnchor="middle" className="fill-ink-400" style={{ fontSize: 2.2, letterSpacing: '0.08em' }}>
                  {c.label.toUpperCase()}
                </text>
              </motion.g>
            );
          })}
          <defs>
            <radialGradient id="thermalGlow">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>

        {/* Colour scale */}
        <div className="relative z-10 mt-3">
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-[#34D3EE] via-[#60A5FA] via-50% to-[#A78BFA] to-[#F87171]" />
          <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-ink-600">
            <span>{fmt(min - 2, 0)} °C</span>
            <span>nominal band</span>
            <span>{fmt(max + 2, 0)} °C</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'WARM', value: THRESHOLDS.thermal.warm, color: '#22D3EE' },
          { label: 'HIGH', value: THRESHOLDS.thermal.high, color: '#FBBF24' },
          { label: 'CRITICAL', value: THRESHOLDS.thermal.critical, color: '#F87171' },
          { label: 'STATUS', value: THERMAL_TONE[status].label, color: STATUS_DOT[status] },
        ].map((t) => (
          <div key={t.label} className="panel-inset px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', t.label === 'STATUS' ? tone.text : '')} style={t.label === 'STATUS' ? undefined : { background: t.color }} />
              <span className="micro">{t.label}</span>
            </div>
            <p className={cn('mt-1.5 font-mono text-[14px] tabular-nums', t.label === 'STATUS' ? tone.text : 'text-ink-100')}>
              {typeof t.value === 'number' ? `${t.value} °C` : t.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
