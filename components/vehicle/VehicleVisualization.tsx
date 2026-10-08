'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit, thermalColor } from '@/lib/format';
import type { BatteryState, TelemetryReading } from '@/types';

export type VehicleNodeKey = 'solar' | 'fuelCell' | 'battery' | 'motor' | 'thermal' | 'ai';

export interface VehicleNode {
  key: VehicleNodeKey;
  label: string;
  eyebrow: string;
  description: string;
  hotspot: { x: number; y: number };
  labelAnchor: 'above' | 'below' | 'left' | 'right';
}

export const VEHICLE_NODES: VehicleNode[] = [
  {
    key: 'solar',
    label: 'SOLAR',
    eyebrow: 'PZEM #1 Â· 0x01',
    description: 'Roof and hood photovoltaic array feeding the DC bus through a dedicated MPPT channel.',
    hotspot: { x: 520, y: 128 },
    labelAnchor: 'above',
  },
  {
    key: 'fuelCell',
    label: 'FUEL CELL',
    eyebrow: 'PZEM #2 Â· 0x02',
    description: 'Hydrogen fuel-cell stack with humidifier and air compressor, output metered on channel 2.',
    hotspot: { x: 806, y: 300 },
    labelAnchor: 'below',
  },
  {
    key: 'battery',
    label: 'BATTERY',
    eyebrow: 'PZEM #3 Â· 0x03 Â· 48 V pack',
    description: '13S lithium pack on the skateboard chassis. Channel 3 measures the traction bus directly.',
    hotspot: { x: 505, y: 322 },
    labelAnchor: 'below',
  },
  {
    key: 'motor',
    label: 'MOTOR',
    eyebrow: 'Inverter Â· traction drive',
    description: 'Permanent-magnet traction motor and inverter. Load is inferred from channel 3 power.',
    hotspot: { x: 252, y: 296 },
    labelAnchor: 'left',
  },
  {
    key: 'thermal',
    label: 'THERMAL SENSORS',
    eyebrow: 'DS18B20 Ã—4',
    description: 'Four 1-Wire probes placed on the PV array, fuel-cell stack, inverter and battery enclosure.',
    hotspot: { x: 414, y: 262 },
    labelAnchor: 'above',
  },
  {
    key: 'ai',
    label: 'AI SYSTEM',
    eyebrow: 'ESP32-S3 Â· edge inference',
    description: 'SOC prediction, range prediction and anomaly detection executed on the microcontroller.',
    hotspot: { x: 700, y: 216 },
    labelAnchor: 'above',
  },
];

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

/** Map a power level (W) to an animation duration in seconds. */
function flowDuration(powerW: number | null | undefined, floor: number) {
  const p = Math.abs(powerW ?? 0);
  if (p < floor) return null;
  return clamp(7.4 - (p / 2000) * 5.6, 1.5, 8);
}

export function VehicleVisualization({
  latest,
  battery,
  className,
  compact = false,
  showFlow = true,
  onNodeChange,
}: {
  latest: TelemetryReading | null;
  battery: BatteryState | null;
  className?: string;
  compact?: boolean;
  showFlow?: boolean;
  onNodeChange?: (key: VehicleNodeKey) => void;
}) {
  const [active, setActive] = useState<VehicleNodeKey>('battery');
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const solarW = latest ? absOrNull(latest.solar.power) : 0;
  const fcW = latest ? absOrNull(latest.fuelCell.power) : 0;
  const loadW = latest ? absOrNull(latest.vehicle.power) : 0;

  const solarDur = flowDuration(solarW, 8);
  const fcDur = flowDuration(fcW, 12);
  const motorDur = flowDuration(loadW, 20);

  const node = useMemo(() => VEHICLE_NODES.find((n) => n.key === active) ?? VEHICLE_NODES[2], [active]);

  const select = (key: VehicleNodeKey) => {
    setActive(key);
    onNodeChange?.(key);
  };

  const temp = latest?.temperature;

  return (
    <div className={cn('relative w-full', className)}>
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-[0.35]" />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-full bg-volt-600/[0.07] blur-3xl" />

      <svg viewBox="0 0 1000 430" className="relative z-10 w-full" role="group" aria-label="Interactive electric vehicle system diagram">
        <defs>
          <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B2434" />
            <stop offset="46%" stopColor="#141B27" />
            <stop offset="100%" stopColor="#0A0F18" />
          </linearGradient>
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1D3350" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#0E1B2E" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#0A1420" stopOpacity="0.96" />
          </linearGradient>
          <linearGradient id={`${uid}-panel`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#153C63" />
            <stop offset="50%" stopColor="#0E2942" />
            <stop offset="100%" stopColor="#0A1B2C" />
          </linearGradient>
          <linearGradient id={`${uid}-sill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#24344C" />
            <stop offset="100%" stopColor="#101825" />
          </linearGradient>
          <linearGradient id={`${uid}-tyre`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A2230" />
            <stop offset="100%" stopColor="#080B12" />
          </linearGradient>
          <linearGradient id={`${uid}-head`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#BFDBFE" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={`${uid}-tail`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FCA5A5" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#F87171" stopOpacity="0.12" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="500" cy="366" rx="440" ry="16" fill="#000" opacity="0.55" filter={`url(#${uid}-soft)`} />

        {/* Wheels */}
        {[252, 760].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="332" r="62" fill={`url(#${uid}-tyre)`} stroke="#2B3648" strokeWidth="1.2" />
            <circle cx={cx} cy="332" r="44" fill="none" stroke="#39465C" strokeWidth="1" opacity="0.85" />
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={cx + 15 * Math.cos(a)}
                  y1={332 + 15 * Math.sin(a)}
                  x2={cx + 40 * Math.cos(a)}
                  y2={332 + 40 * Math.sin(a)}
                  stroke="#46566E"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  opacity="0.8"
                />
              );
            })}
            <circle cx={cx} cy="332" r="13" fill="#0E1420" stroke="#5A6B84" strokeWidth="1" />
            <circle cx={cx} cy="332" r="4.5" fill="#64748B" opacity="0.7" />
          </g>
        ))}

        {/* Body */}
        <path
          d="M60 330 C60 292 84 268 128 258 L238 238 C266 234 288 224 308 206 L376 148 C396 132 416 126 444 126 L594 126 C630 126 652 137 674 159 L744 232 C756 245 778 252 806 254 L898 264 C934 269 954 292 954 322 L954 336 C954 344 948 348 938 348 L78 348 C66 348 60 342 60 330 Z"
          fill={`url(#${uid}-body)`}
          stroke="#33415A"
          strokeWidth="1.4"
        />

        {/* Shoulder crease */}
        <path d="M118 292 C300 276 700 268 928 288" fill="none" stroke="#3E4F6B" strokeWidth="1" opacity="0.55" />
        <path d="M118 296 C300 280 700 272 928 292" fill="none" stroke="#243247" strokeWidth="2.2" opacity="0.5" />

        {/* Sill / underbody */}
        <rect x="120" y="330" width="800" height="16" rx="7" fill={`url(#${uid}-sill)`} opacity="0.9" />

        {/* Glass */}
        <path d="M598 150 L678 240 L476 240 L476 150 Z" fill={`url(#${uid}-glass)`} stroke="#31425C" strokeWidth="1" />
        <path d="M436 150 L476 150 L476 240 L356 240 Z" fill={`url(#${uid}-glass)`} stroke="#31425C" strokeWidth="1" />
        <path d="M436 150 L476 150 L476 240 L356 240 Z" fill="#22D3EE" opacity="0.05" />
        <line x1="476" y1="150" x2="476" y2="240" stroke="#0A121C" strokeWidth="7" />
        <path d="M604 158 L676 234" stroke="#4E6280" strokeWidth="1" opacity="0.5" />
        <path d="M452 158 L378 234" stroke="#4E6280" strokeWidth="1" opacity="0.5" />

        {/* Doors */}
        <line x1="596" y1="150" x2="620" y2="332" stroke="#26324A" strokeWidth="1" />
        <line x1="476" y1="152" x2="486" y2="332" stroke="#26324A" strokeWidth="1" />
        <line x1="356" y1="242" x2="344" y2="332" stroke="#26324A" strokeWidth="1" />
        <rect x="606" y="252" width="16" height="3.4" rx="1.7" fill="#4A5B75" />
        <rect x="484" y="252" width="16" height="3.4" rx="1.7" fill="#4A5B75" />

        {/* Mirrors */}
        <path d="M596 246 L620 240 L628 250 L604 256 Z" fill="#1B2434" stroke="#3A4A64" strokeWidth="1" />

        {/* Lights */}
        <path d="M944 300 C960 302 964 312 958 322 L934 322 C938 314 942 306 944 300 Z" fill={`url(#${uid}-head)`} />
        <rect x="64" y="286" width="26" height="9" rx="4.5" fill={`url(#${uid}-tail)`} />

        {/* Solar array â€” roof */}
        <g
          className={cn('cursor-pointer', active === 'solar' && 'brightness-125')}
          onClick={() => select('solar')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('solar')}
          role="button"
          tabIndex={0}
          aria-label="Solar array"
        >
          <path d="M424 122 L606 122 L622 142 L408 142 Z" fill={`url(#${uid}-panel)`} stroke={active === 'solar' ? '#FBBF24' : '#2B4A6B'} strokeWidth={active === 'solar' ? 1.8 : 1} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={430 + i * 40} y1="124" x2={414 + i * 40} y2="140" stroke="#3E6E9E" strokeWidth="0.8" opacity="0.8" />
          ))}
          <line x1="418" y1="132" x2="614" y2="132" stroke="#3E6E9E" strokeWidth="0.7" opacity="0.6" />
        </g>

        {/* Solar array â€” hood */}
        <g
          className="cursor-pointer"
          onClick={() => select('solar')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('solar')}
          role="button"
          tabIndex={0}
          aria-label="Solar hood array"
        >
          <path d="M700 252 L802 256 L796 272 L696 268 Z" fill={`url(#${uid}-panel)`} stroke={active === 'solar' ? '#FBBF24' : '#2B4A6B'} strokeWidth={active === 'solar' ? 1.8 : 1} />
          {[0, 1, 2].map((i) => (
            <line key={i} x1={718 + i * 28} y1={254 + i * 0.6} x2={714 + i * 28} y2={270 + i * 0.6} stroke="#3E6E9E" strokeWidth="0.8" opacity="0.8" />
          ))}
        </g>

        {/* Fuel-cell stack */}
        <g
          className="cursor-pointer"
          onClick={() => select('fuelCell')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('fuelCell')}
          role="button"
          tabIndex={0}
          aria-label="Fuel cell stack"
        >
          <rect
            x="748"
            y="276"
            width="122"
            height="44"
            rx="10"
            fill="#0E2233"
            stroke={active === 'fuelCell' ? '#22D3EE' : '#245C74'}
            strokeWidth={active === 'fuelCell' ? 1.8 : 1}
          />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={756 + i * 16} y="284" width="9" height="28" rx="3" fill="#22D3EE" opacity={0.18 + (i % 2) * 0.12} />
          ))}
          <text x="809" y="274" textAnchor="middle" className="fill-ion-300" style={{ fontSize: 9, letterSpacing: '0.16em' }}>
            H2 STACK
          </text>
        </g>

        {/* Battery pack */}
        <g
          className="cursor-pointer"
          onClick={() => select('battery')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('battery')}
          role="button"
          tabIndex={0}
          aria-label="Battery pack"
        >
          <rect
            x="320"
            y="296"
            width="380"
            height="40"
            rx="10"
            fill="#0C1A2E"
            stroke={active === 'battery' ? '#3B82F6' : '#234A7A'}
            strokeWidth={active === 'battery' ? 1.8 : 1}
          />
          {Array.from({ length: 13 }, (_, i) => {
            const soc = battery?.soc ?? 0;
            const filled = i / 13 <= soc / 100;
            return (
              <rect
                key={i}
                x={330 + i * 28}
                y="304"
                width="20"
                height="24"
                rx="4"
                fill={filled ? '#3B82F6' : '#16243A'}
                opacity={filled ? 0.75 : 0.7}
              />
            );
          })}
          <text x="510" y="292" textAnchor="middle" className="fill-volt-300" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
            48 V Â· 13S PACK
          </text>
        </g>

        {/* Traction motor + inverter */}
        <g
          className="cursor-pointer"
          onClick={() => select('motor')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('motor')}
          role="button"
          tabIndex={0}
          aria-label="Traction motor"
        >
          <circle
            cx="252"
            cy="300"
            r="30"
            fill="#0D1726"
            stroke={active === 'motor' ? '#60A5FA' : '#2C4568'}
            strokeWidth={active === 'motor' ? 1.8 : 1}
          />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={252 + 11 * Math.cos(a)}
                y1={300 + 11 * Math.sin(a)}
                x2={252 + 23 * Math.cos(a)}
                y2={300 + 23 * Math.sin(a)}
                stroke="#60A5FA"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.7"
              />
            );
          })}
          <circle cx="252" cy="300" r="9" fill="#0A1220" stroke="#60A5FA" strokeWidth="1" opacity="0.9" />
          <rect x="300" y="272" width="42" height="34" rx="7" fill="#101E33" stroke={active === 'motor' ? '#60A5FA' : '#2C4568'} strokeWidth="1" />
          <text x="321" y="293" textAnchor="middle" className="fill-volt-300" style={{ fontSize: 8, letterSpacing: '0.1em' }}>
            INV
          </text>
        </g>

        {/* AI controller */}
        <g
          className="cursor-pointer"
          onClick={() => select('ai')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('ai')}
          role="button"
          tabIndex={0}
          aria-label="AI system"
        >
          <rect
            x="664"
            y="196"
            width="72"
            height="44"
            rx="9"
            fill="#101B2E"
            stroke={active === 'ai' ? '#A78BFA' : '#3E3A6E'}
            strokeWidth={active === 'ai' ? 1.8 : 1}
          />
          <rect x="676" y="208" width="48" height="20" rx="4" fill="#1E1B4B" stroke="#6D5BD0" strokeWidth="0.8" />
          <text x="700" y="221" textAnchor="middle" className="fill-violet-200" style={{ fontSize: 8.5, letterSpacing: '0.12em' }}>
            ESP32-S3
          </text>
          {Array.from({ length: 5 }, (_, i) => (
            <rect key={`l${i}`} x={666 + i * 15} y="192" width="6" height="4" rx="1" fill="#6D5BD0" opacity="0.85" />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <rect key={`b${i}`} x={666 + i * 15} y="240" width="6" height="4" rx="1" fill="#6D5BD0" opacity="0.85" />
          ))}
        </g>

        {/* DS18B20 probes */}
        <ThermalProbes
          active={active === 'thermal'}
          onSelect={() => select('thermal')}
          temp={temp ? { t1: temp.t1, t2: temp.t2, t3: temp.t3, t4: temp.t4 } : null}
          uid={uid}
        />

        {/* Animated energy flow */}
        {showFlow ? (
          <g>
            {solarDur ? (
              <>
                <path id={`${uid}-pSolar`} d="M520 148 L520 292" stroke="#FBBF24" strokeWidth="1.6" fill="none" opacity="0.35" strokeDasharray="3 5" />
                <circle r="4" fill="#FDE68A">
                  <animateMotion dur={`${solarDur}s`} repeatCount="indefinite" path={`M0,0 L0,144`} />
                </circle>
              </>
            ) : null}
            {fcDur ? (
              <>
                <path d="M809 276 L809 296 L700 316" stroke="#22D3EE" strokeWidth="1.6" fill="none" opacity="0.35" strokeDasharray="3 5" />
                <circle r="4" fill="#A5F3FC">
                  <animateMotion dur={`${fcDur}s`} repeatCount="indefinite" path="M0,0 L0,20 L-109,40 L-109,40" />
                </circle>
              </>
            ) : null}
            {motorDur ? (
              <>
                <path d="M320 316 L252 316 L252 306" stroke="#60A5FA" strokeWidth="1.6" fill="none" opacity="0.35" strokeDasharray="3 5" />
                <circle r="4" fill="#BFDBFE">
                  <animateMotion dur={`${motorDur}s`} repeatCount="indefinite" path="M0,0 L-68,0 L-68,-10" />
                </circle>
              </>
            ) : null}
          </g>
        ) : null}

        {/* Hotspots */}
        {VEHICLE_NODES.map((n) => {
          const on = active === n.key;
          const powerFor =
            n.key === 'solar' ? solarW : n.key === 'fuelCell' ? fcW : n.key === 'motor' || n.key === 'battery' ? loadW : 0;
          return (
            <g key={n.key} className="cursor-pointer" onClick={() => select(n.key)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select(n.key)} role="button" tabIndex={0} aria-label={n.label}>
              <circle cx={n.hotspot.x} cy={n.hotspot.y} r={20} fill="transparent" />
              <AnimatePresence>
                {on ? (
                  <motion.circle
                    key="ring"
                    cx={n.hotspot.x}
                    cy={n.hotspot.y}
                    r={13}
                    fill="none"
                    stroke={ACCENT[n.key]}
                    strokeWidth="1.6"
                    initial={{ scale: 0.7, opacity: 0.9 }}
                    animate={{ scale: [0.85, 1.5], opacity: [0.75, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                    style={{ transformOrigin: `${n.hotspot.x}px ${n.hotspot.y}px` }}
                  />
                ) : null}
              </AnimatePresence>
              <circle
                cx={n.hotspot.x}
                cy={n.hotspot.y}
                r={on ? 6.5 : 4.4}
                fill={on ? ACCENT[n.key] : '#0B1220'}
                stroke={ACCENT[n.key]}
                strokeWidth={on ? 2 : 1.4}
                className="transition-all duration-300"
              />
              {n.key === 'solar' && solarDur ? (
                <circle cx={n.hotspot.x} cy={n.hotspot.y} r="9" fill="none" stroke="#FBBF24" strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="8;15;8" dur={`${solarDur}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur={`${solarDur}s`} repeatCount="indefinite" />
                </circle>
              ) : null}
              {n.key === 'motor' && motorDur ? (
                <circle cx={n.hotspot.x} cy={n.hotspot.y} r="9" fill="none" stroke="#60A5FA" strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="8;15;8" dur={`${motorDur}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur={`${motorDur}s`} repeatCount="indefinite" />
                </circle>
              ) : null}
              {!compact ? (
                <text
                  x={n.hotspot.x + (n.labelAnchor === 'left' ? -16 : 0)}
                  y={n.hotspot.y + (n.labelAnchor === 'above' ? -18 : n.labelAnchor === 'below' ? 22 : 4)}
                  textAnchor={n.labelAnchor === 'left' ? 'end' : n.labelAnchor === 'right' ? 'start' : 'middle'}
                  className={on ? 'fill-ink-50' : 'fill-ink-400'}
                  style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 600 }}
                >
                  {n.label}
                  {n.key === 'battery' && battery ? ` Â· ${fmt(battery.soc, 1, EM)}%` : ''}
                  {n.key === 'solar' && latest ? ` Â· ${fmtPower(solarW)} ${fmtPowerUnit(solarW)}` : ''}
                  {n.key === 'motor' && latest ? ` Â· ${fmtPower(loadW)} ${fmtPowerUnit(loadW)}` : ''}
                  {n.key === 'fuelCell' && latest ? ` Â· ${fmtPower(fcW)} ${fmtPowerUnit(fcW)}` : ''}
                  {n.key === 'thermal' && temp ? ` Â· ${fmt(temp.max, 1, EM)}Â°C` : ''}
                  {n.key === 'ai' && latest ? ` Â· ${fmt(latest.ai.anomalyScore, 3, EM)}` : ''}
                </text>
              ) : null}
              {powerFor == null ? null : powerFor > 0 && !compact ? null : null}
            </g>
          );
        })}
      </svg>

      {/* Legend / selected node caption */}
      <AnimatePresence mode="wait">
        <motion.div
          key={node.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="relative z-10 mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-1 pt-3"
        >
          <div className="min-w-0">
            <p className="micro-strong" style={{ color: ACCENT[node.key] }}>
              {node.label}
            </p>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-ink-400">{node.description}</p>
          </div>
          <span className="chip shrink-0">{node.eyebrow}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const ACCENT: Record<VehicleNodeKey, string> = {
  solar: '#FBBF24',
  fuelCell: '#22D3EE',
  battery: '#3B82F6',
  motor: '#60A5FA',
  thermal: '#F87171',
  ai: '#A78BFA',
};

function ThermalProbes({
  active,
  onSelect,
  temp,
  uid,
}: {
  active: boolean;
  onSelect: () => void;
  temp: { t1: number | null; t2: number | null; t3: number | null; t4: number | null } | null;
  uid: string;
}) {
  const probes = [
    { key: 'T1' as const, x: 452, y: 160, cx: 452, cy: 160 },
    { key: 'T2' as const, x: 806, y: 268, cx: 806, cy: 268 },
    { key: 'T3' as const, x: 288, y: 258, cx: 288, cy: 258 },
    { key: 'T4' as const, x: 610, y: 288, cx: 610, cy: 288 },
  ];
  return (
    <g className="cursor-pointer" onClick={onSelect} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()} role="button" tabIndex={0} aria-label="Thermal sensors">
      {probes.map((p) => {
        const v = temp ? temp[p.key.toLowerCase() as 't1' | 't2' | 't3' | 't4'] : null;
        const color = typeof v === 'number' && Number.isFinite(v) ? thermalColor(v) : '#64748B';
        return (
          <g key={p.key}>
            <circle cx={p.cx} cy={p.cy} r={active ? 9 : 6} fill="#0B1220" stroke={color} strokeWidth={active ? 2 : 1.3} />
            <circle cx={p.cx} cy={p.cy} r="2" fill={color} />
            {active ? (
              <text x={p.cx} y={p.cy - 14} textAnchor="middle" className="fill-ink-200" style={{ fontSize: 9, letterSpacing: '0.1em' }}>
                {p.key} {v != null ? `${fmt(v, 1, EM)}Â°` : 'â€”'}
              </text>
            ) : null}
          </g>
        );
      })}
      <title>{`DS18B20 probes â€” ${probes.map((p) => `${p.key}`).join(' Â· ')}`}</title>
      <defs>
        <radialGradient id={`${uid}-probe`}>
          <stop offset="0%" stopColor="#F87171" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F87171" stopOpacity="0" />
        </radialGradient>
      </defs>
    </g>
  );
}
