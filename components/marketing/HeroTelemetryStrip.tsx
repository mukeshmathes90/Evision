'use client';

import { motion } from 'framer-motion';
import { BatteryCharging, Flame, GaugeCircle, Sun, Thermometer, Zap } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit, LINK_META } from '@/lib/format';
import { AI_TONE } from '@/lib/constants';
import type { ApiEnvelope, DataEnvelope, OverviewPayload } from '@/types';

const LINK_HEX: Record<string, string> = {
  online: '#34D399',
  delayed: '#FBBF24',
  offline: '#F87171',
  unknown: '#4C5A73',
};

/**
 * Live telemetry strip for the marketing hero. Values come from the same
 * server-side aggregation as the dashboard, so the landing page never invents
 * numbers and reflects the live MongoDB state (or the labelled demo).
 */
export function HeroTelemetryStrip({
  initial,
  deviceId,
  intervalMs = 10000,
  external,
}: {
  initial: ApiEnvelope<OverviewPayload>;
  deviceId: string;
  intervalMs?: number;
  /** When supplied the parent already polls, so the strip renders passively. */
  external?: DataEnvelope<OverviewPayload>;
}) {
  const { data } = useLiveData<ApiEnvelope<OverviewPayload>>(
    `/api/dashboard?device=${encodeURIComponent(deviceId)}&range=24h`,
    initial,
    intervalMs,
    !external,
  );

  const env: DataEnvelope<OverviewPayload> | undefined = external ?? data?.envelope;
  const p = env?.data;
  const latest = p?.latest ?? null;
  const link = env?.link ?? 'unknown';
  const demo = env?.source === 'demo';
  const linkMeta = LINK_META[link];
  const aiState = p?.ai.state ?? 'normal';

  const items = [
    {
      icon: Sun,
      color: '#FBBF24',
      label: 'Solar generation',
      value: latest ? fmtPower(absOrNull(latest.solar.power)) : EM,
      unit: latest ? fmtPowerUnit(latest.solar.power) : '',
      sub: latest ? `${fmt(latest.solar.voltage)} V Â· ${fmt(latest.solar.current)} A` : 'awaiting frame',
    },
    {
      icon: Flame,
      color: '#22D3EE',
      label: 'Fuel-cell stack',
      value: latest ? fmtPower(absOrNull(latest.fuelCell.power)) : EM,
      unit: latest ? fmtPowerUnit(latest.fuelCell.power) : '',
      sub: latest ? `${fmt(latest.fuelCell.voltage)} V Â· ${fmt(latest.fuelCell.current)} A` : 'awaiting frame',
    },
    {
      icon: BatteryCharging,
      color: '#3B82F6',
      label: 'State of charge',
      value: fmt(p?.ai.soc ?? null, 1),
      unit: '%',
      sub: p?.battery ? `${p.battery.mode.toUpperCase()} Â· ${fmt(p.battery.netPowerW)} W net` : 'AI-MODEL-01',
      tone: AI_TONE[aiState].text,
    },
    {
      icon: GaugeCircle,
      color: '#A78BFA',
      label: 'Predicted range',
      value: fmt(p?.ai.range ?? null, 1),
      unit: 'km',
      sub: 'AI-MODEL-02 horizon',
    },
    {
      icon: Thermometer,
      color: '#F87171',
      label: 'Thermal peak',
      value: fmt(p?.thermal.max ?? null, 1),
      unit: 'Â°C',
      sub: p?.thermal.status ? p.thermal.status.toUpperCase() : 'NO DATA',
    },
    {
      icon: Zap,
      color: '#60A5FA',
      label: 'Traction bus',
      value: latest ? fmtPower(absOrNull(latest.vehicle.power)) : EM,
      unit: latest ? fmtPowerUnit(latest.vehicle.power) : '',
      sub: latest ? `${fmt(latest.vehicle.voltage)} V Â· ${fmt(latest.vehicle.current)} A` : 'awaiting frame',
    },
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-hydro-400" />
            <span className="relative h-2 w-2 rounded-full" style={{ background: LINK_HEX[link] }} />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-300">{env?.deviceLabel ?? 'vehicle'}</span>
          <span className={`chip ${link === 'online' ? 'chip-active' : ''}`}>{linkMeta.label}</span>
          {demo ? <span className="chip border-sun-500/40 bg-sun-500/10 text-sun-400">Demo dataset</span> : null}
        </div>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
          MongoDB Atlas Â· {env?.generatedAt ? env.generatedAt.replace('T', ' ').slice(0, 19) : EM} UTC
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="bg-void-950/70 px-4 py-3.5"
          >
            <div className="flex items-center gap-1.5">
              <it.icon className="h-3.5 w-3.5" style={{ color: it.color }} />
              <span className="micro">{it.label}</span>
            </div>
            <p className="mt-2 font-mono text-[19px] tabular-nums leading-none text-ink-50">
              {it.value}
              <span className="ml-1 text-[10px] text-ink-500">{it.unit}</span>
            </p>
            <p className={`mt-1.5 text-[10px] ${it.tone ?? 'text-ink-500'}`}>{it.sub}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}