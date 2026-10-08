'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit, thermalColor } from '@/lib/format';
import type { BatteryState, TelemetryReading } from '@/types';
import { CAR_ART, CAR_PALETTE } from './carArt';

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
    eyebrow: 'PZEM #1 · 0x01',
    description: 'Roof and hood photovoltaic array feeding the DC bus through a dedicated MPPT channel.',
    hotspot: { x: 542, y: 116 },
    labelAnchor: 'above',
  },
  {
    key: 'fuelCell',
    label: 'FUEL CELL',
    eyebrow: 'PZEM #2 · 0x02',
    description: 'Hydrogen fuel-cell stack with humidifier and air compressor, output metered on channel 2.',
    hotspot: { x: 814, y: 264 },
    labelAnchor: 'below',
  },
  {
    key: 'battery',
    label: 'BATTERY',
    eyebrow: 'PZEM #3 · 0x03 · 48 V pack',
    description: '13S lithium pack on the skateboard chassis. Channel 3 measures the traction bus directly.',
    hotspot: { x: 511, y: 278 },
    labelAnchor: 'below',
  },
  {
    key: 'motor',
    label: 'MOTOR',
    eyebrow: 'Inverter · traction drive',
    description: 'Permanent-magnet traction motor and inverter. Load is inferred from channel 3 power.',
    hotspot: { x: 292, y: 232 },
    labelAnchor: 'left',
  },
  {
    key: 'thermal',
    label: 'THERMAL SENSORS',
    eyebrow: 'DS18B20 ×4',
    description: 'Four 1-Wire probes placed on the PV array, fuel-cell stack, inverter and battery enclosure.',
    hotspot: { x: 446, y: 214 },
    labelAnchor: 'above',
  },
  {
    key: 'ai',
    label: 'AI SYSTEM',
    eyebrow: 'ESP32-S3 · edge inference',
    description: 'SOC prediction, range prediction and anomaly detection executed on the microcontroller.',
    hotspot: { x: 584, y: 226 },
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
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="500" cy="338" rx="396" ry="13" fill="#000" opacity="0.5" filter={`url(#${uid}-soft)`} />

        {/* Flat car body — shared canonical artwork */}
        <g transform="translate(100,70) scale(2)">
          {/* Wheels (flat: tyre, rim, spokes, hub) */}
          {[CAR_ART.wheels.rear, CAR_ART.wheels.front].map((w) => (
            <g key={`${w.cx}`}>
              <circle cx={w.cx} cy={w.cy} r={w.r} fill={CAR_PALETTE.tyre} />
              <circle cx={w.cx} cy={w.cy} r={w.r - 3} fill="none" stroke={CAR_PALETTE.bodyEdge} strokeWidth="1.4" />
              <circle cx={w.cx} cy={w.cy} r={w.r - 12} fill={CAR_PALETTE.rim} />
              {Array.from({ length: 5 }, (_, i) => {
                const a = (i / 5) * Math.PI * 2 + 0.3;
                return (
                  <line
                    key={i}
                    x1={w.cx + 5 * Math.cos(a)}
                    y1={w.cy + 5 * Math.sin(a)}
                    x2={w.cx + (w.r - 13) * Math.cos(a)}
                    y2={w.cy + (w.r - 13) * Math.sin(a)}
                    stroke={CAR_PALETTE.hub}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                );
              })}
              <circle cx={w.cx} cy={w.cy} r="5" fill={CAR_PALETTE.hub} opacity="0.85" />
            </g>
          ))}

          {/* Body */}
          <path d={CAR_ART.body} fill={CAR_PALETTE.body} stroke={CAR_PALETTE.bodyEdge} strokeWidth="1.4" />

          {/* Shoulder crease */}
          <path d={CAR_ART.crease} fill="none" stroke={CAR_PALETTE.crease} strokeWidth="1.4" strokeLinecap="round" />

          {/* Glass */}
          <path d={CAR_ART.glassRear} fill={CAR_PALETTE.glass} stroke={CAR_PALETTE.glassEdge} strokeWidth="1" />
          <path d={CAR_ART.glassFront} fill={CAR_PALETTE.glass} stroke={CAR_PALETTE.glassEdge} strokeWidth="1" />
          <path d={CAR_ART.bPillar} fill={CAR_PALETTE.pillar} />

          {/* Door line + handle + mirror */}
          <path d={CAR_ART.doorLine} stroke={CAR_PALETTE.crease} strokeWidth="1.2" fill="none" />
          <rect {...CAR_ART.handle} fill={CAR_PALETTE.detail} />
          <path d={CAR_ART.mirror} fill={CAR_PALETTE.body} stroke={CAR_PALETTE.bodyEdge} strokeWidth="1" />

          {/* Lights */}
          <path d={CAR_ART.headlight} fill={CAR_PALETTE.headlight} opacity="0.9" />
          <rect {...CAR_ART.taillight} fill={CAR_PALETTE.taillight} opacity="0.9" />
        </g>

        {/* Solar array — roof */}
        <g
          className={cn('cursor-pointer', active === 'solar' && 'brightness-125')}
          onClick={() => select('solar')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('solar')}
          role="button"
          tabIndex={0}
          aria-label="Solar array"
        >
          <rect x="462" y="108" width="160" height="18" rx="6" fill="#12283F" stroke={active === 'solar' ? '#FBBF24' : '#2B4A6B'} strokeWidth={active === 'solar' ? 1.8 : 1} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={478 + i * 32} y1="110" x2={474 + i * 32} y2="124" stroke="#3E6E9E" strokeWidth="1.4" opacity="0.8" />
          ))}
          <line x1="466" y1="117" x2="618" y2="117" stroke="#3E6E9E" strokeWidth="1.2" opacity="0.7" />
        </g>

        {/* Solar array — hood */}
        <g
          className="cursor-pointer"
          onClick={() => select('solar')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select('solar')}
          role="button"
          tabIndex={0}
          aria-label="Solar hood array"
        >
          <path d="M 754 196 L 844 212 L 838 224 L 748 210 Z" fill="#12283F" stroke={active === 'solar' ? '#FBBF24' : '#2B4A6B'} strokeWidth={active === 'solar' ? 1.8 : 1} />
          {[0, 1, 2].map((i) => (
            <line key={i} x1={770 + i * 24} y1={199 + i * 4} x2={766 + i * 24} y2={211 + i * 4} stroke="#3E6E9E" strokeWidth="1.4" opacity="0.8" />
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
            x="776"
            y="238"
            width="76"
            height="38"
            rx="8"
            fill="#0E2233"
            stroke={active === 'fuelCell' ? '#22D3EE' : '#245C74'}
            strokeWidth={active === 'fuelCell' ? 1.8 : 1}
          />
          {Array.from({ length: 5 }, (_, i) => (
            <rect key={i} x={784 + i * 14} y="246" width="8" height="22" rx="3" fill="#22D3EE" opacity={0.18 + (i % 2) * 0.12} />
          ))}
          <text x="814" y="234" textAnchor="middle" className="fill-ion-300" style={{ fontSize: 9, letterSpacing: '0.16em' }}>
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
            x="386"
            y="254"
            width="250"
            height="38"
            rx="8"
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
                x={396 + i * 18}
                y="262"
                width="14"
                height="22"
                rx="3"
                fill={filled ? '#3B82F6' : '#16243A'}
                opacity={filled ? 0.75 : 0.7}
              />
            );
          })}
          <text x="460" y="248" textAnchor="middle" className="fill-volt-300" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
            48 V · 13S PACK
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
            cx="292"
            cy="232"
            r="28"
            fill="#0D1726"
            stroke={active === 'motor' ? '#60A5FA' : '#2C4568'}
            strokeWidth={active === 'motor' ? 1.8 : 1}
          />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={292 + 10 * Math.cos(a)}
                y1={232 + 10 * Math.sin(a)}
                x2={292 + 21 * Math.cos(a)}
                y2={232 + 21 * Math.sin(a)}
                stroke="#60A5FA"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.7"
              />
            );
          })}
          <circle cx="292" cy="232" r="8" fill="#0A1220" stroke="#60A5FA" strokeWidth="1" opacity="0.9" />
          <rect x="334" y="210" width="52" height="44" rx="8" fill="#101E33" stroke={active === 'motor' ? '#60A5FA' : '#2C4568'} strokeWidth="1" />
          <text x="360" y="237" textAnchor="middle" className="fill-volt-300" style={{ fontSize: 9, letterSpacing: '0.1em' }}>
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
            x="536"
            y="204"
            width="96"
            height="44"
            rx="9"
            fill="#101B2E"
            stroke={active === 'ai' ? '#A78BFA' : '#3E3A6E'}
            strokeWidth={active === 'ai' ? 1.8 : 1}
          />
          <rect x="548" y="214" width="72" height="24" rx="4" fill="#1E1B4B" stroke="#6D5BD0" strokeWidth="0.8" />
          <text x="584" y="230" textAnchor="middle" className="fill-violet-200" style={{ fontSize: 9, letterSpacing: '0.12em' }}>
            ESP32-S3
          </text>
          {Array.from({ length: 5 }, (_, i) => (
            <rect key={`l${i}`} x={546 + i * 17} y="199" width="8" height="5" rx="1.5" fill="#6D5BD0" opacity="0.85" />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <rect key={`b${i}`} x={546 + i * 17} y="248" width="8" height="5" rx="1.5" fill="#6D5BD0" opacity="0.85" />
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
                <path id={`${uid}-pSolar`} d="M500 126 L500 252" stroke="#FBBF24" strokeWidth="1.6" fill="none" opacity="0.35" strokeDasharray="3 5" />
                <circle r="4" fill="#FDE68A">
                  <animateMotion dur={`${solarDur}s`} repeatCount="indefinite" path="M0,0 L0,126" />
                </circle>
              </>
            ) : null}
            {fcDur ? (
              <>
                <path d="M814 236 L636 236 L636 252" stroke="#22D3EE" strokeWidth="1.6" fill="none" opacity="0.35" strokeDasharray="3 5" />
                <circle r="4" fill="#A5F3FC">
                  <animateMotion dur={`${fcDur}s`} repeatCount="indefinite" path="M0,0 L-178,0 L-178,16" />
                </circle>
              </>
            ) : null}
            {motorDur ? (
              <>
                <path d="M400 254 L400 200 L326 200 L324 232" stroke="#60A5FA" strokeWidth="1.6" fill="none" opacity="0.35" strokeDasharray="3 5" />
                <circle r="4" fill="#BFDBFE">
                  <animateMotion dur={`${motorDur}s`} repeatCount="indefinite" path="M0,0 L0,-54 L-74,-54 L-76,-22" />
                </circle>
              </>
            ) : null}
          </g>
        ) : null}

        {/* Hotspots */}
        {VEHICLE_NODES.map((n) => {
          const on = active === n.key;
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
                  {n.key === 'battery' && battery ? ` · ${fmt(battery.soc, 1, EM)}%` : ''}
                  {n.key === 'solar' && latest ? ` · ${fmtPower(solarW)} ${fmtPowerUnit(solarW)}` : ''}
                  {n.key === 'motor' && latest ? ` · ${fmtPower(loadW)} ${fmtPowerUnit(loadW)}` : ''}
                  {n.key === 'fuelCell' && latest ? ` · ${fmtPower(fcW)} ${fmtPowerUnit(fcW)}` : ''}
                  {n.key === 'thermal' && temp ? ` · ${fmt(temp.max, 1, EM)}°C` : ''}
                  {n.key === 'ai' && latest ? ` · ${fmt(latest.ai.anomalyScore, 3, EM)}` : ''}
                </text>
              ) : null}
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
    { key: 'T1' as const, x: 500, y: 117, cx: 500, cy: 117 },
    { key: 'T2' as const, x: 836, y: 248, cx: 836, cy: 248 },
    { key: 'T3' as const, x: 292, y: 250, cx: 292, cy: 250 },
    { key: 'T4' as const, x: 610, y: 273, cx: 610, cy: 273 },
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
                {p.key} {v != null ? `${fmt(v, 1, EM)}°` : '—'}
              </text>
            ) : null}
          </g>
        );
      })}
      <title>{`DS18B20 probes — ${probes.map((p) => `${p.key}`).join(' · ')}`}</title>
      <defs>
        <radialGradient id={`${uid}-probe`}>
          <stop offset="0%" stopColor="#F87171" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F87171" stopOpacity="0" />
        </radialGradient>
      </defs>
    </g>
  );
}
