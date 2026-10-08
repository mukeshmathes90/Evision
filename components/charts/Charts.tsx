'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import { CHART_COLORS } from '@/lib/constants';
import { AXIS_PROPS, ChartLegend, ChartTooltip, GRID_PROPS } from './ChartFrame';
import { makeTimeFormatter } from '@/lib/time-range';
import type { SeriesPoint } from '@/types';
import { THRESHOLDS } from '@/lib/constants';

const fmt = (from: number, to: number) => makeTimeFormatter(from, to);

export function PowerChart({
  points,
  from,
  to,
  height = 260,
  showBattery = true,
}: {
  points: SeriesPoint[];
  from: number;
  to: number;
  height?: number;
  showBattery?: boolean;
}) {
  const t = fmt(from, to);
  const series = [
    { label: 'Vehicle load', color: CHART_COLORS.vehicle, key: 'vehiclePower' },
    { label: 'Solar', color: CHART_COLORS.solar, key: 'solarPower' },
    { label: 'Fuel cell', color: CHART_COLORS.fuelCell, key: 'fuelCellPower' },
    ...(showBattery ? [{ label: 'Pack net', color: CHART_COLORS.battery, key: 'batteryPower' }] : []),
  ];
  return (
    <div style={{ height }}>
      <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <ResponsiveContainer width="100%" height="90%">
        <ComposedChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gVehicle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.vehicle} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS.vehicle} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.solar} stopOpacity={0.24} />
              <stop offset="100%" stopColor={CHART_COLORS.solar} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gFc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.fuelCell} stopOpacity={0.24} />
              <stop offset="100%" stopColor={CHART_COLORS.fuelCell} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" tickFormatter={t} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={46} unit=" W" />
          <Tooltip
            content={<ChartTooltip unitByKey={{ vehiclePower: ' W', solarPower: ' W', fuelCellPower: ' W', batteryPower: ' W' }} />}
            cursor={{ stroke: 'rgba(255,255,255,0.16)', strokeWidth: 1 }}
          />
          <Area type="monotone" dataKey="vehiclePower" name="Vehicle load" stroke="none" fill="url(#gVehicle)" isAnimationActive={false} />
          <Area type="monotone" dataKey="solarPower" name="Solar" stroke="none" fill="url(#gSolar)" isAnimationActive={false} />
          <Area type="monotone" dataKey="fuelCellPower" name="Fuel cell" stroke="none" fill="url(#gFc)" isAnimationActive={false} />
          <Line type="monotone" dataKey="vehiclePower" name="Vehicle load" stroke={CHART_COLORS.vehicle} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="solarPower" name="Solar" stroke={CHART_COLORS.solar} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="fuelCellPower" name="Fuel cell" stroke={CHART_COLORS.fuelCell} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          {showBattery ? (
            <Line
              type="monotone"
              dataKey="batteryPower"
              name="Pack net"
              stroke={CHART_COLORS.battery}
              strokeWidth={1.6}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VoltageChart({ points, from, to, height = 240 }: { points: SeriesPoint[]; from: number; to: number; height?: number }) {
  const t = fmt(from, to);
  return (
    <div style={{ height }}>
      <ChartLegend
        items={[
          { label: 'Vehicle bus', color: CHART_COLORS.vehicle },
          { label: 'Solar array', color: CHART_COLORS.solar },
          { label: 'Fuel cell', color: CHART_COLORS.fuelCell },
          { label: 'Low-voltage threshold', color: '#F87171', dashed: true },
        ]}
      />
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" tickFormatter={t} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={46} unit=" V" domain={['dataMin - 2', 'dataMax + 2']} />
          <Tooltip content={<ChartTooltip unitByKey={{ vehicleVoltage: ' V', solarVoltage: ' V', fuelCellVoltage: ' V' }} />} cursor={{ stroke: 'rgba(255,255,255,0.16)' }} />
          <ReferenceLine y={THRESHOLDS.batteryVoltageLow} stroke="#F87171" strokeDasharray="4 5" strokeOpacity={0.6} />
          <Line type="monotone" dataKey="vehicleVoltage" name="Vehicle bus" stroke={CHART_COLORS.vehicle} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="solarVoltage" name="Solar array" stroke={CHART_COLORS.solar} strokeWidth={1.7} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="fuelCellVoltage" name="Fuel cell" stroke={CHART_COLORS.fuelCell} strokeWidth={1.7} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CurrentChart({ points, from, to, height = 240 }: { points: SeriesPoint[]; from: number; to: number; height?: number }) {
  const t = fmt(from, to);
  return (
    <div style={{ height }}>
      <ChartLegend
        items={[
          { label: 'Vehicle current', color: CHART_COLORS.vehicle },
          { label: 'Solar current', color: CHART_COLORS.solar },
          { label: 'Fuel-cell current', color: CHART_COLORS.fuelCell },
          { label: 'Pack current', color: CHART_COLORS.battery },
        ]}
      />
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" tickFormatter={t} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={46} unit=" A" />
          <Tooltip content={<ChartTooltip unitByKey={{ vehicleCurrent: ' A', solarCurrent: ' A', fuelCellCurrent: ' A', batteryCurrent: ' A' }} />} cursor={{ stroke: 'rgba(255,255,255,0.16)' }} />
          <Line type="monotone" dataKey="vehicleCurrent" name="Vehicle current" stroke={CHART_COLORS.vehicle} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="solarCurrent" name="Solar current" stroke={CHART_COLORS.solar} strokeWidth={1.7} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="fuelCellCurrent" name="Fuel cell" stroke={CHART_COLORS.fuelCell} strokeWidth={1.7} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="batteryCurrent" name="Pack current" stroke={CHART_COLORS.battery} strokeWidth={1.6} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Chart points mirror `SeriesPoint`, where a missing probe is `null`. Recharts
 * leaves a gap for a null value instead of drawing a line through it, which is
 * exactly the "no data" behaviour the dashboard promises.
 */
export interface ThermalPoint {
  t: number;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  t4: number | null;
  tempMax?: number | null;
}

export function TemperatureChart({
  points,
  from,
  to,
  height = 260,
  withMax = true,
}: {
  points: ThermalPoint[];
  from: number;
  to: number;
  height?: number;
  withMax?: boolean;
}) {
  const t = fmt(from, to);
  return (
    <div style={{ height }}>
      <ChartLegend
        items={[
          { label: 'T1 PV roof', color: CHART_COLORS.temp1 },
          { label: 'T2 fuel cell', color: CHART_COLORS.temp2 },
          { label: 'T3 inverter/motor', color: CHART_COLORS.temp3 },
          { label: 'T4 battery', color: CHART_COLORS.temp4 },
          ...(withMax ? [{ label: 'High limit', color: '#FBBF24', dashed: true }] : []),
        ]}
      />
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" tickFormatter={t} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={46} unit=" °C" domain={['dataMin - 4', 'dataMax + 4']} />
          <Tooltip content={<ChartTooltip unitByKey={{ t1: ' °C', t2: ' °C', t3: ' °C', t4: ' °C', tempMax: ' °C' }} />} cursor={{ stroke: 'rgba(255,255,255,0.16)' }} />
          <ReferenceLine y={THRESHOLDS.thermal.high} stroke="#FBBF24" strokeDasharray="4 5" strokeOpacity={0.55} />
          <Line type="monotone" dataKey="t1" name="T1" stroke={CHART_COLORS.temp1} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="t2" name="T2" stroke={CHART_COLORS.temp2} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="t3" name="T3" stroke={CHART_COLORS.temp3} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="t4" name="T4" stroke={CHART_COLORS.temp4} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          {withMax ? (
            <Line type="monotone" dataKey="tempMax" name="Max probe" stroke="#FBBF24" strokeWidth={1.4} strokeDasharray="3 4" dot={false} isAnimationActive={false} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SignalPoint {
  t: number;
  soc: number | null;
  range: number | null;
}

export function SOCChart({ points, from, to, height = 250 }: { points: SignalPoint[]; from: number; to: number; height?: number }) {
  const t = fmt(from, to);
  return (
    <div style={{ height }}>
      <ChartLegend
        items={[
          { label: 'State of charge', color: CHART_COLORS.soc },
          { label: 'Low reserve', color: '#FBBF24', dashed: true },
          { label: 'Critical', color: '#F87171', dashed: true },
        ]}
      />
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gSoc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.soc} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.soc} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" tickFormatter={t} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={46} unit=" %" domain={[0, 100]} />
          <Tooltip content={<ChartTooltip unitByKey={{ soc: ' %', range: ' km' }} />} cursor={{ stroke: 'rgba(255,255,255,0.16)' }} />
          <ReferenceLine y={THRESHOLDS.socLow} stroke="#FBBF24" strokeDasharray="4 5" strokeOpacity={0.6} />
          <ReferenceLine y={THRESHOLDS.socCritical} stroke="#F87171" strokeDasharray="4 5" strokeOpacity={0.6} />
          <Area type="monotone" dataKey="soc" name="State of charge" stroke={CHART_COLORS.soc} strokeWidth={2.2} fill="url(#gSoc)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RangeChart({ points, from, to, height = 250 }: { points: SignalPoint[]; from: number; to: number; height?: number }) {
  const t = fmt(from, to);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gRange" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" tickFormatter={t} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={48} unit=" km" />
          <Tooltip content={<ChartTooltip unitByKey={{ range: ' km' }} />} cursor={{ stroke: 'rgba(255,255,255,0.16)' }} />
          <Area type="monotone" dataKey="range" name="Estimated range" stroke="#22D3EE" strokeWidth={2.2} fill="url(#gRange)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnomalyChart({ points, from, to, height = 220 }: { points: SeriesPoint[]; from: number; to: number; height?: number }) {
  const t = fmt(from, to);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" tickFormatter={t} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={40} domain={[0, 1]} />
          <Tooltip content={<ChartTooltip unitByKey={{ anomalyScore: '' }} />} cursor={{ stroke: 'rgba(255,255,255,0.16)' }} />
          <ReferenceLine y={THRESHOLDS.anomaly.warning} stroke="#FBBF24" strokeDasharray="4 5" strokeOpacity={0.6} />
          <ReferenceLine y={THRESHOLDS.anomaly.critical} stroke="#F87171" strokeDasharray="4 5" strokeOpacity={0.6} />
          <ReferenceArea y1={THRESHOLDS.anomaly.warning} y2={1} fill="#F87171" fillOpacity={0.05} />
          <Line type="monotone" dataKey="anomalyScore" name="Anomaly score" stroke={CHART_COLORS.anomaly} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnergyBucketChart({
  buckets,
  height = 280,
  keys = ['solarKwh', 'fuelCellKwh', 'vehicleKwh'],
}: {
  buckets: { label: string; solarKwh: number; fuelCellKwh: number; vehicleKwh: number; netKwh: number }[];
  height?: number;
  keys?: ('solarKwh' | 'fuelCellKwh' | 'vehicleKwh')[];
}) {
  const palette: Record<string, string> = {
    solarKwh: CHART_COLORS.solar,
    fuelCellKwh: CHART_COLORS.fuelCell,
    vehicleKwh: CHART_COLORS.vehicle,
  };
  const names: Record<string, string> = {
    solarKwh: 'Solar generated',
    fuelCellKwh: 'Fuel-cell generated',
    vehicleKwh: 'Vehicle consumed',
  };
  return (
    <div style={{ height }}>
      <ChartLegend items={keys.map((k) => ({ label: names[k], color: palette[k] }))} />
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={buckets} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...AXIS_PROPS} width={48} unit=" kWh" />
          <Tooltip content={<ChartTooltip unitByKey={{ solarKwh: ' kWh', fuelCellKwh: ' kWh', vehicleKwh: ' kWh' }} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} name={names[k]} fill={palette[k]} fillOpacity={0.82 - i * 0.06} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetEnergyChart({ buckets, height = 260 }: { buckets: { label: string; netKwh: number }[]; height?: number }) {
  const data = buckets.map((b) => ({ label: b.label, pos: Math.max(0, b.netKwh), neg: Math.min(0, b.netKwh) }));
  return (
    <div style={{ height }}>
      <ChartLegend
        items={[
          { label: 'Surplus generated', color: '#34D399' },
          { label: 'Deficit drawn down', color: '#F87171' },
        ]}
      />
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...AXIS_PROPS} width={48} unit=" kWh" />
          <Tooltip
            content={<ChartTooltip unitByKey={{ pos: ' kWh', neg: ' kWh' }} mode="signed" />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" />
          <Bar dataKey="pos" name="Surplus" stackId="net" fill="#34D399" fillOpacity={0.82} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="neg" name="Deficit" stackId="net" fill="#F87171" fillOpacity={0.82} radius={[0, 0, 3, 3]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

