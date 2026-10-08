'use client';

import { motion } from 'framer-motion';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit } from '@/lib/format';
import type { BatteryState, TelemetryReading } from '@/types';
import { CAR_ART, CAR_PALETTE } from '@/components/vehicle/carArt';

const RING = [
  { r: 152, speed: 26, dots: 3, color: '#60A5FA' },
  { r: 126, speed: 19, dots: 4, color: '#22D3EE' },
  { r: 100, speed: 13, dots: 2, color: '#A78BFA' },
];

/** Cinematic hero visual: flat EV illustration inside rotating telemetry rings. */
export function HeroVehicle({ latest, battery }: { latest: TelemetryReading | null; battery: BatteryState | null }) {
  const soc = battery?.soc ?? null;
  const circ = 2 * Math.PI * 78;
  const dash = soc != null ? (Math.min(100, Math.max(0, soc)) / 100) * circ : 0;

  const nodes = [
    { label: 'SOC', value: `${fmt(soc, 0, EM)} %`, color: '#60A5FA' },
    { label: 'SOLAR', value: latest ? `${fmtPower(absOrNull(latest.solar.power))} ${fmtPowerUnit(latest.solar.power)}` : EM, color: '#FBBF24' },
    { label: 'STACK', value: latest ? `${fmtPower(absOrNull(latest.fuelCell.power))} ${fmtPowerUnit(latest.fuelCell.power)}` : EM, color: '#22D3EE' },
    { label: 'TRACTION', value: latest ? `${fmtPower(absOrNull(latest.vehicle.power))} ${fmtPowerUnit(latest.vehicle.power)}` : EM, color: '#60A5FA' },
    { label: 'THERMAL', value: latest ? `${fmt(latest.temperature.max, 1, EM)} °C` : EM, color: '#F87171' },
    { label: 'ANOMALY', value: latest ? fmt(latest.ai.anomalyScore, 3, EM) : EM, color: '#A78BFA' },
  ];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      {/* Ambient glow */}
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.22),rgba(6,182,212,0.10)_45%,transparent_70%)] blur-2xl" />

      <svg viewBox="0 0 400 400" className="relative h-full w-full">
        <defs>
          <linearGradient id="hv-soc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>

        {/* Rotating rings */}
        {RING.map((ring) => (
          <g key={ring.r}>
            <circle cx="200" cy="200" r={ring.r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: ring.speed, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: '200px 200px' }}
            >
              {Array.from({ length: ring.dots }).map((_, i) => {
                const a = (i / ring.dots) * Math.PI * 2;
                return (
                  <circle
                    key={i}
                    cx={200 + ring.r * Math.cos(a)}
                    cy={200 + ring.r * Math.sin(a)}
                    r="3.2"
                    fill={ring.color}
                    opacity="0.85"
                  />
                );
              })}
            </motion.g>
          </g>
        ))}

        {/* SOC arc */}
        <circle cx="200" cy="200" r="78" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <motion.circle
          cx="200"
          cy="200"
          r="78"
          fill="none"
          stroke="url(#hv-soc)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          transform="rotate(-90 200 200)"
        />

        {/* Flat EV illustration — shared canonical artwork */}
        <motion.g
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <g transform="translate(88,170) scale(0.56)">
            {/* Wheels */}
            {[CAR_ART.wheels.rear, CAR_ART.wheels.front].map((w) => (
              <g key={`${w.cx}`}>
                <circle cx={w.cx} cy={w.cy} r={w.r} fill={CAR_PALETTE.tyre} />
                <circle cx={w.cx} cy={w.cy} r={w.r - 3} fill="none" stroke={CAR_PALETTE.bodyEdge} strokeWidth="2.2" />
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
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                  );
                })}
                <circle cx={w.cx} cy={w.cy} r="5" fill={CAR_PALETTE.hub} opacity="0.85" />
              </g>
            ))}

            {/* Body */}
            <path d={CAR_ART.body} fill={CAR_PALETTE.body} stroke={CAR_PALETTE.bodyEdge} strokeWidth="2.4" />
            <path d={CAR_ART.crease} fill="none" stroke={CAR_PALETTE.crease} strokeWidth="2.4" strokeLinecap="round" />

            {/* Glass */}
            <path d={CAR_ART.glassRear} fill={CAR_PALETTE.glass} stroke={CAR_PALETTE.glassEdge} strokeWidth="1.8" />
            <path d={CAR_ART.glassFront} fill={CAR_PALETTE.glass} stroke={CAR_PALETTE.glassEdge} strokeWidth="1.8" />
            <path d={CAR_ART.bPillar} fill={CAR_PALETTE.pillar} />

            {/* Details */}
            <path d={CAR_ART.doorLine} stroke={CAR_PALETTE.crease} strokeWidth="2.2" fill="none" />
            <rect {...CAR_ART.handle} fill={CAR_PALETTE.detail} />
            <path d={CAR_ART.mirror} fill={CAR_PALETTE.body} stroke={CAR_PALETTE.bodyEdge} strokeWidth="1.8" />
            <path d={CAR_ART.headlight} fill={CAR_PALETTE.headlight} opacity="0.9" />
            <rect {...CAR_ART.taillight} fill={CAR_PALETTE.taillight} opacity="0.9" />
          </g>
          {/* Charge bolt */}
          <motion.path
            d="M208 196 L198 214 L206 214 L202 230 L216 210 L207 210 Z"
            fill="#FBBF24"
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.g>

        {/* Central readouts */}
        <text x="200" y="196" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, fill: '#F5F8FF' }}>
          {soc != null ? soc.toFixed(0) : EM}
        </text>
        <text x="200" y="212" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.22em', fill: '#6B7C99' }}>
          SOC %
        </text>
        <text x="200" y="308" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', fill: '#4C5A73' }}>
          {battery ? battery.mode.toUpperCase() : 'NO DATA'}
        </text>
      </svg>

      {/* Orbiting value chips */}
      <div className="pointer-events-none absolute inset-0">
        {nodes.map((n, i) => {
          const pos = [
            'left-0 top-1/2 -translate-y-1/2',
            'right-0 top-[26%] -translate-y-1/2',
            'right-[2%] bottom-[16%]',
            'left-[2%] bottom-[16%]',
            'left-0 top-[24%] -translate-y-1/2',
            'right-0 top-1/2 -translate-y-1/2 mt-[92px]',
          ][i];
          return (
            <motion.div
              key={n.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
              className={`absolute ${pos} hidden sm:block`}
            >
              <div className="panel-inset px-2.5 py-1.5 backdrop-blur-xl">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.color }} />
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-ink-500">{n.label}</span>
                </span>
                <p className="mt-0.5 font-mono text-[11.5px] tabular-nums text-ink-100">{n.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
