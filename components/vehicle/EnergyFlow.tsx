'use client';

import { motion } from 'framer-motion';
import { BatteryCharging, Flame, Gauge, Sun, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit } from '@/lib/format';
import type { BatteryState, TelemetryReading } from '@/types';

/**
 * Animated energy-flow schematic. Flow direction and animation speed are
 * derived from the live telemetry: sources push into the pack, the pack feeds
 * the traction inverter, and the traction bus returns through the pack when
 * the vehicle is regenerating.
 */
export function EnergyFlow({
  latest,
  battery,
  className,
  orientation = 'vertical',
}: {
  latest: TelemetryReading | null;
  battery: BatteryState | null;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}) {
  const solarW = latest ? absOrNull(latest.solar.power) : null;
  const fcW = latest ? absOrNull(latest.fuelCell.power) : null;
  const loadW = latest ? absOrNull(latest.vehicle.power) : null;
  const net = battery?.netPowerW ?? 0;
  const regen = net > 4;

  const speed = (w: number | null, max: number, base: number) =>
    `${Math.max(0.9, base - ((Math.min(w ?? 0, max) ?? 0) / max) * (base - 1.1)).toFixed(2)}s`;

  const horizontal = orientation === 'horizontal';

  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none absolute inset-0 grid-dots opacity-[0.18]" />
      <div className={cn('relative grid gap-4', horizontal ? 'grid-cols-[1fr_auto_1fr_auto_1fr] items-center' : 'grid-cols-3 items-start')}>
        {/* Solar */}
        <FlowNode
          icon={Sun}
          color="#FBBF24"
          title="SOLAR"
          sub="PZEM #1 Â· 0x01"
          power={solarW}
          rows={[
            ['Voltage', fmt(latest?.solar.voltage), 'V'],
            ['Current', fmt(latest?.solar.current), 'A'],
            ['Energy', fmt(latest?.solar.energy, 1), 'kWh'],
          ]}
          className={horizontal ? '' : 'col-start-1'}
        />

        {/* Fuel cell */}
        <FlowNode
          icon={Flame}
          color="#22D3EE"
          title="FUEL CELL"
          sub="PZEM #2 Â· 0x02"
          power={fcW}
          rows={[
            ['Voltage', fmt(latest?.fuelCell.voltage), 'V'],
            ['Current', fmt(latest?.fuelCell.current), 'A'],
            ['Energy', fmt(latest?.fuelCell.energy, 1), 'kWh'],
          ]}
          className={horizontal ? '' : 'col-start-3'}
        />

        {/* Battery (centre) */}
        <FlowNode
          icon={BatteryCharging}
          color="#3B82F6"
          title="BATTERY"
          sub="48 V pack Â· PZEM #3"
          power={Math.abs(net)}
          hero
          rows={[
            ['SOC', fmt(battery?.soc), '%'],
            ['Mode', (battery?.mode ?? 'â€”').toUpperCase(), ''],
            ['Net power', fmtPower(net), fmtPowerUnit(net)],
          ]}
          className={horizontal ? '' : 'col-span-3 col-start-1 mx-auto w-full max-w-[380px]'}
        />

        {/* Motor */}
        <FlowNode
          icon={Zap}
          color="#60A5FA"
          title="TRACTION MOTOR"
          sub="Inverter Â· drive unit"
          power={loadW}
          rows={[
            ['Voltage', fmt(latest?.vehicle.voltage), 'V'],
            ['Current', fmt(latest?.vehicle.current), 'A'],
            ['Energy', fmt(latest?.vehicle.energy, 1), 'kWh'],
          ]}
          className={horizontal ? '' : 'col-span-3 col-start-1 mx-auto w-full max-w-[380px]'}
        />

        {/* Flows */}
        <svg
          className={cn('pointer-events-none absolute inset-0 h-full w-full', horizontal ? '' : '')}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="flowSolar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="flowFc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="flowLoad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

<FlowConnector
          vertical
          color="#FBBF24"
          active={(solarW ?? 0) > 8}
          power={solarW}
          speed={speed(solarW, 2000, 4.2)}
          label="PV array → DC bus"
          className={horizontal ? 'col-start-2 row-start-1' : 'col-start-1 row-start-2'}
        />
        <FlowConnector
          vertical
          color="#22D3EE"
          active={(fcW ?? 0) > 12}
          power={fcW}
          speed={speed(fcW, 1500, 4.6)}
          label="Fuel cell → DC bus"
          className={horizontal ? 'col-start-4 row-start-1' : 'col-start-3 row-start-2'}
        />
{/* Traction connect */}
        <FlowConnector
          vertical
          color={regen ? '#34D399' : '#60A5FA'}
          active={(loadW ?? 0) > 10}
          power={loadW}
          speed={speed(loadW, 3000, 4)}
          label={regen ? 'Motor → pack (regen)' : 'Pack → traction'}
          className={horizontal ? 'col-start-5 row-start-1' : 'col-start-1 row-start-4'}
          wide
        />
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/[0.06] pt-3">
        {[
          { c: '#FBBF24', l: `Solar ${fmtPower(solarW ?? 0)} ${fmtPowerUnit(solarW ?? 0)}${solarW == null ? ' (n/a)' : ''}` },
          { c: '#22D3EE', l: `Fuel cell ${fmtPower(fcW ?? 0)} ${fmtPowerUnit(fcW ?? 0)}${fcW == null ? ' (n/a)' : ''}` },
          { c: '#3B82F6', l: `Pack ${fmtPower(net)} ${fmtPowerUnit(net)}` },
          { c: '#60A5FA', l: `Traction ${fmtPower(loadW ?? 0)} ${fmtPowerUnit(loadW ?? 0)}${loadW == null ? ' (n/a)' : ''}` },
        ].map((i) => (
          <span key={i.l} className="inline-flex items-center gap-1.5 text-[10.5px] text-ink-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: i.c }} />
            {i.l}
          </span>
        ))}
        {!latest ? <span className="text-[10.5px] text-ink-600">{EM} awaiting telemetry</span> : null}
      </div>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  color,
  title,
  sub,
  power,
  rows,
  hero = false,
  className,
}: {
  icon: typeof Sun;
  color: string;
  title: string;
  sub: string;
  power: number | null;
  rows: [string, string, string][];
  hero?: boolean;
  className?: string;
}) {
  const known = typeof power === 'number' && Number.isFinite(power);
  return (
    <div
      className={cn('panel relative overflow-hidden', hero && 'ring-1 ring-white/[0.1]', className)}
      style={{ boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.05), 0 24px 60px -40px ${color}` }}
    >
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className={cn('relative', hero ? 'p-5' : 'p-4')}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color }} />
            <span>
              <span className="block text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-100">{title}</span>
              <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-500">{sub}</span>
            </span>
          </span>
          <span className="text-right">
            <span className="block font-mono text-[15px] tabular-nums" style={{ color }}>
              {known ? fmtPower(power as number) : EM}
            </span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">{known ? fmtPowerUnit(power as number) : 'n/a'}</span>
          </span>
        </div>
        <div className={cn('mt-3 grid gap-x-4 gap-y-1', hero ? 'grid-cols-3' : 'grid-cols-3')}>
          {rows.map(([k, v, u]) => (
            <div key={k}>
              <p className="micro">{k}</p>
              <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-100">
                {v}
                {u ? <span className="ml-0.5 text-[9px] text-ink-500">{u}</span> : null}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${known ? (power as number) > 0 ? Math.min(100, ((power as number) / 3000) * 100) : 0 : 0}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

function FlowConnector({
  color,
  active,
  power,
  speed,
  label,
  vertical = true,
  wide = false,
  className,
}: {
  color: string;
  active: boolean;
  power: number | null;
  speed: string;
  label: string;
  vertical?: boolean;
  wide?: boolean;
  className?: string;
}) {
  const intensity = Math.min(1, (power ?? 0) / 2000);
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div className={cn('relative', vertical ? 'h-10 w-px' : 'h-px w-10', wide && 'h-12')}>
        <span
          className="absolute inset-0"
          style={{
            background: `linear-gradient(${vertical ? '180deg' : '90deg'}, ${active ? `${color}55` : 'rgba(255,255,255,0.07)'}, ${active ? `${color}18` : 'rgba(255,255,255,0.03)'})`,
          }}
        />
        {active ? (
          <>
            <motion.span
              className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              style={{ background: color, boxShadow: `0 0 10px ${color}` }}
              animate={vertical ? { top: ['-10%', '105%'] } : { left: ['-10%', '105%'] }}
              transition={{ duration: Number.parseFloat(speed), repeat: Infinity, ease: 'linear' }}
            />
            <motion.span
              className="absolute left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
              style={{ background: color, opacity: 0.6 }}
              animate={vertical ? { top: ['-10%', '105%'] } : { left: ['-10%', '105%'] }}
              transition={{ duration: Number.parseFloat(speed), repeat: Infinity, ease: 'linear', delay: Number.parseFloat(speed) / 2 }}
            />
          </>
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <span className="h-1 w-1 rounded-full bg-ink-600" />
          </span>
        )}
      </div>
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-ink-600">
        {label}
      </span>
      <span
        className="absolute left-1/2 -translate-x-1/2 text-[9px] font-medium"
        style={{ color, opacity: 0.25 + intensity * 0.6 }}
      >
        {active ? `${Math.round(intensity * 100)}%` : 'idle'}
      </span>
    </div>
  );
}

export function EnergyFlowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[10.5px] text-ink-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-hydro-400" /> Charging
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-warn-400" /> Discharging
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-ink-500" /> Idle
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Gauge className="h-3 w-3" /> Animation speed scales with power
      </span>
    </div>
  );
}
