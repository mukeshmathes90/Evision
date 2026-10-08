'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  BatteryCharging,
  BrainCircuit,
  CircleDot,
  Cpu,
  Flame,
  Gauge,
  GaugeCircle,
  Radio,
  Sun,
  Thermometer,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { absOrNull, EM, fmt, fmtPower, fmtPowerUnit, thermalColor } from '@/lib/format';
import { THRESHOLDS } from '@/lib/constants';
import { VEHICLE_NODES, type VehicleNodeKey } from './VehicleVisualization';
import type { BatteryState, TelemetryReading } from '@/types';

const ICONS: Record<VehicleNodeKey, typeof Sun> = {
  solar: Sun,
  fuelCell: Flame,
  battery: BatteryCharging,
  motor: Zap,
  thermal: Thermometer,
  ai: BrainCircuit,
};

const ACCENT: Record<VehicleNodeKey, string> = {
  solar: '#FBBF24',
  fuelCell: '#22D3EE',
  battery: '#3B82F6',
  motor: '#60A5FA',
  thermal: '#F87171',
  ai: '#A78BFA',
};

export function VehicleNodePicker({
  active,
  onSelect,
  latest,
}: {
  active: VehicleNodeKey;
  onSelect: (k: VehicleNodeKey) => void;
  latest: TelemetryReading | null;
}) {
  const live: Record<VehicleNodeKey, string> = {
    solar: latest ? `${fmtPower(absOrNull(latest.solar.power))} ${fmtPowerUnit(latest.solar.power)}` : EM,
    fuelCell: latest ? `${fmtPower(absOrNull(latest.fuelCell.power))} ${fmtPowerUnit(latest.fuelCell.power)}` : EM,
    battery: latest ? `${fmt(latest.ai.soc, 1, EM)} %` : EM,
    motor: latest ? `${fmtPower(absOrNull(latest.vehicle.power))} ${fmtPowerUnit(latest.vehicle.power)}` : EM,
    thermal: latest ? `${fmt(latest.temperature.max, 1, EM)} Â°C` : EM,
    ai: latest ? fmt(latest.ai.anomalyScore, 3, EM) : EM,
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {VEHICLE_NODES.map((n) => {
        const Icon = ICONS[n.key];
        const on = active === n.key;
        return (
          <button
            key={n.key}
            type="button"
            onClick={() => onSelect(n.key)}
            className={cn(
              'group relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-300',
              on ? 'border-white/[0.18] bg-white/[0.07]' : 'border-white/[0.07] bg-white/[0.022] hover:border-white/[0.14] hover:bg-white/[0.045]',
            )}
            style={on ? { boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.06), 0 18px 40px -28px ${ACCENT[n.key]}` } : undefined}
          >
            {on ? <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: ACCENT[n.key] }} /> : null}
            <span className="flex items-center justify-between">
              <Icon className="h-4 w-4" style={{ color: on ? ACCENT[n.key] : '#64748B' }} />
              <span className="font-mono text-[10px] text-ink-500">{n.eyebrow.split('Â·')[0].trim()}</span>
            </span>
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-100">{n.label}</span>
            <span className="mt-1 block font-mono text-[12px] tabular-nums text-ink-300">{live[n.key]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="text-[11.5px] text-ink-400">{label}</span>
      <span className={cn('font-mono text-[13px] tabular-nums', tone ?? 'text-ink-50')}>
        {value}
        {unit ? <span className="ml-1 text-[10px] text-ink-500">{unit}</span> : null}
      </span>
    </div>
  );
}

function Contribution({ value, color, label }: { value: number | null; color: string; label: string }) {
  const has = value != null && Number.isFinite(value);
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="text-ink-400">{label}</span>
        <span className="font-mono tabular-nums text-ink-200">{has ? `${(value as number).toFixed(1)} %` : EM}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${has ? Math.min(100, Math.max(0, value as number)) : 0}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function VehicleComponentPanel({
  node,
  latest,
  battery,
  generationTotal,
}: {
  node: VehicleNodeKey;
  latest: TelemetryReading | null;
  battery: BatteryState | null;
  generationTotal: number;
}) {
  const meta = VEHICLE_NODES.find((n) => n.key === node)!;
  const Icon = ICONS[node];

  if (!latest) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-14 text-center">
        <Radio className="h-5 w-5 text-ink-600" />
        <p className="mt-3 text-[13px] text-ink-300">Waiting for telemetryâ€¦</p>
        <p className="mt-1.5 max-w-xs text-[11.5px] leading-relaxed text-ink-500">
          The MongoDB Atlas <span className="font-mono">telemetry</span> collection has no document for this device inside the live
          window. Values appear the moment the ESP32-S3 writes its next frame.
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={node}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="rounded-xl border p-2"
              style={{ color: ACCENT[node], borderColor: `${ACCENT[node]}40`, background: `${ACCENT[node]}12` }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-50">{meta.label}</h3>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{meta.eyebrow}</p>
            </div>
          </div>
          <span className="chip">from MongoDB Atlas</span>
        </div>

        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">{meta.description}</p>

        <div className="mt-4">
          {node === 'battery' ? (
            <>
              <Row label="Battery voltage" value={fmt(latest.vehicle.voltage)} unit="V" />
              <Row label="Battery current" value={fmt(latest.vehicle.current)} unit="A" tone={(latest.vehicle.current ?? 0) < 0 ? 'text-hydro-400' : 'text-ink-50'} />
              <Row label="Battery power" value={fmtPower(absOrNull(latest.vehicle.power))} unit={fmtPowerUnit(latest.vehicle.power)} />
              <Row label="State of charge (AI)" value={fmt(latest.ai.soc)} unit="%" tone="text-volt-300" />
              <Row label="Estimated range (AI)" value={fmt(latest.ai.range)} unit="km" tone="text-ion-300" />
              <Row label="Lifetime energy" value={fmt(latest.vehicle.energy, 1)} unit="kWh" />
              <Row label="Pack mode" value={(battery?.mode ?? 'â€”').toUpperCase()} tone="text-ink-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Contribution value={latest.ai.soc} color={ACCENT.battery} label="Charge level" />
                <Contribution
                  value={latest.vehicle.power == null ? null : Math.min(100, (absOrNull(latest.vehicle.power) as number / THRESHOLDS.vehiclePowerHigh) * 100)}
                  color="#60A5FA"
                  label="Load vs design limit"
                />
              </div>
            </>
          ) : null}

          {node === 'solar' ? (
            <>
              <Row label="Solar voltage" value={fmt(latest.solar.voltage)} unit="V" tone="text-sun-400" />
              <Row label="Solar current" value={fmt(latest.solar.current)} unit="A" tone="text-sun-400" />
              <Row label="Solar power" value={fmtPower(absOrNull(latest.solar.power))} unit={fmtPowerUnit(latest.solar.power)} tone="text-sun-400" />
              <Row label="Solar energy" value={fmt(latest.solar.energy, 1)} unit="kWh" tone="text-sun-400" />
              <Row
                label="Solar contribution"
                value={generationTotal > 0 && latest.solar.power != null ? ((absOrNull(latest.solar.power) as number / generationTotal) * 100).toFixed(1) : EM}
                unit="%"
                tone="text-sun-400"
              />
              <div className="mt-4">
                <Contribution value={latest.solar.power == null ? null : (absOrNull(latest.solar.power) as number / THRESHOLDS.solarPowerNominal) * 100} color="#FBBF24" label="Array output vs 2.0 kWp rated" />
              </div>
            </>
          ) : null}

          {node === 'fuelCell' ? (
            <>
              <Row label="Fuel-cell voltage" value={fmt(latest.fuelCell.voltage)} unit="V" tone="text-ion-300" />
              <Row label="Fuel-cell current" value={fmt(latest.fuelCell.current)} unit="A" tone="text-ion-300" />
              <Row label="Fuel-cell power" value={fmtPower(absOrNull(latest.fuelCell.power))} unit={fmtPowerUnit(latest.fuelCell.power)} tone="text-ion-300" />
              <Row label="Fuel-cell energy" value={fmt(latest.fuelCell.energy, 1)} unit="kWh" tone="text-ion-300" />
              <Row
                label="Fuel-cell contribution"
                value={generationTotal > 0 && latest.fuelCell.power != null ? ((absOrNull(latest.fuelCell.power) as number / generationTotal) * 100).toFixed(1) : EM}
                unit="%"
                tone="text-ion-300"
              />
              <div className="mt-4">
                <Contribution value={latest.fuelCell.power == null ? null : (absOrNull(latest.fuelCell.power) as number / THRESHOLDS.fuelCellPowerNominal) * 100} color="#22D3EE" label="Stack output vs 1.5 kW rated" />
              </div>
            </>
          ) : null}

          {node === 'motor' ? (
            <>
              <Row label="Vehicle voltage" value={fmt(latest.vehicle.voltage)} unit="V" />
              <Row label="Vehicle current" value={fmt(latest.vehicle.current)} unit="A" />
              <Row label="Vehicle power" value={fmtPower(absOrNull(latest.vehicle.power))} unit={fmtPowerUnit(latest.vehicle.power)} />
              <Row label="Vehicle energy" value={fmt(latest.vehicle.energy, 1)} unit="kWh" />
              <Row label="Pack net power" value={fmtPower(battery?.netPowerW ?? 0)} unit={fmtPowerUnit(battery?.netPowerW ?? 0)} tone={(battery?.netPowerW ?? 0) > 0 ? 'text-hydro-400' : 'text-warn-400'} />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Contribution value={latest.vehicle.power == null ? null : (absOrNull(latest.vehicle.power) as number / THRESHOLDS.vehiclePowerHigh) * 100} color="#60A5FA" label="Load vs 3.0 kW limit" />
                <Contribution value={latest.vehicle.current == null ? null : (absOrNull(latest.vehicle.current) as number / THRESHOLDS.vehicleCurrentHigh) * 100} color="#22D3EE" label="Current vs 60 A limit" />
              </div>
            </>
          ) : null}

          {node === 'thermal' ? (
            <>
              {(['t1', 't2', 't3', 't4'] as const).map((k) => (
                <Row
                  key={k}
                  label={`${k.toUpperCase()} Â· ${
                    k === 't1' ? 'PV roof' : k === 't2' ? 'Fuel-cell stack' : k === 't3' ? 'Inverter / motor' : 'Battery enclosure'
                  }`}
                  value={fmt(latest.temperature[k])}
                  unit="Â°C"
                  tone=""
                />
              ))}
              <Row label="Minimum" value={fmt(latest.temperature.min)} unit="Â°C" tone="text-ion-300" />
              <Row label="Maximum" value={fmt(latest.temperature.max)} unit="Â°C" tone="text-danger-400" />
              <Row label="Average" value={fmt(latest.temperature.avg)} unit="Â°C" tone="text-ink-50" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(['t1', 't2', 't3', 't4'] as const).map((k) => (
                  <Contribution key={k} value={latest.temperature[k]} color={thermalColor(latest.temperature[k])} label={k.toUpperCase()} />
                ))}
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-ink-500">
                Warm â‰¥ {THRESHOLDS.thermal.warm} Â°C Â· High â‰¥ {THRESHOLDS.thermal.high} Â°C Â· Critical â‰¥{' '}
                {THRESHOLDS.thermal.critical} Â°C
              </p>
            </>
          ) : null}

          {node === 'ai' ? (
            <>
              <Row label="SOC prediction" value={fmt(latest.ai.soc)} unit="%" tone="text-volt-300" />
              <Row label="Range prediction" value={fmt(latest.ai.range)} unit="km" tone="text-ion-300" />
              <Row label="Anomaly score" value={fmt(latest.ai.anomalyScore, 3)} tone={(latest.ai.anomalyScore ?? 0) >= THRESHOLDS.anomaly.warning ? 'text-danger-400' : 'text-hydro-400'} />
              <Row label="AI status" value={((latest.ai.anomalyScore ?? 0) >= THRESHOLDS.anomaly.critical ? 'ANOMALY' : (latest.ai.anomalyScore ?? 0) >= THRESHOLDS.anomaly.warning ? 'WARNING' : 'NORMAL')} tone={(latest.ai.anomalyScore ?? 0) >= THRESHOLDS.anomaly.warning ? 'text-warn-400' : 'text-hydro-400'} />
              <Row label="Inference latency" value={fmt(latest.ai.inferenceMs, 2)} unit="ms" />
              <Row label="Forecast horizon" value={String(latest.ai.horizonS ?? 180)} unit="s" />
              <Row label="Active models" value={`${latest.ai.modelsActive ?? 7} / 7`} tone="text-violet-300" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Contribution value={latest.ai.soc} color="#3B82F6" label="SOC" />
                <Contribution value={latest.ai.anomalyScore == null ? null : Math.min(100, latest.ai.anomalyScore * 100)} color="#F87171" label="Anomaly pressure" />
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3 font-mono text-[9.5px] text-ink-600">
          <CircleDot className="h-3 w-3" />
          frame {latest.timestamp} Â· {latest.deviceId}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function VehicleTelemetryStrip({ latest }: { latest: TelemetryReading | null }) {
  const items = [
    { label: 'SOC', value: fmt(latest?.ai.soc, 1, EM), unit: '%', icon: Gauge },
    { label: 'Range', value: fmt(latest?.ai.range, 1, EM), unit: 'km', icon: GaugeCircle },
    { label: 'Pack', value: fmt(latest?.vehicle.power != null ? absOrNull(latest.vehicle.power) as number / 1000 : null, 2, EM), unit: 'kW', icon: BatteryCharging },
    { label: 'Bus', value: fmt(latest?.vehicle.voltage, 1, EM), unit: 'V', icon: Zap },
    { label: 'Thermal', value: fmt(latest?.temperature.max, 1, EM), unit: 'Â°C', icon: Thermometer },
    { label: 'Edge AI', value: fmt(latest?.ai.inferenceMs, 1, EM), unit: 'ms', icon: Cpu },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className="panel-inset px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <i.icon className="h-3 w-3 text-ink-500" />
            <span className="micro">{i.label}</span>
          </div>
          <p className="mt-1.5 font-mono text-[15px] tabular-nums text-ink-50">
            {i.value}
            <span className="ml-1 text-[9.5px] text-ink-500">{i.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
