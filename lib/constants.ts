import type { AlertCategory, AlertSeverity, ThermalStatus, AiModelState } from '@/types';

export const PRODUCT = {
  name: 'EVISION AI',
  tagline: 'Intelligent Energy & Vehicle Intelligence Platform',
  company: 'Viyal Tech',
  description:
    'Real-time energy intelligence combining solar generation, fuel-cell power, battery monitoring, thermal sensing and embedded artificial intelligence.',
} as const;

export const HARDWARE = {
  mcu: 'ESP32-S3 N16R8',
  mcuShort: 'ESP32-S3',
  pzemCount: 3,
  temperatureSensors: 4,
  storage: 'MicroSD (SPI)',
  busVoltage: 48,
  pzemModel: 'PZEM-017',
  pzemProtocol: 'Modbus-RTU over UART (TTL)',
  protocolAddressMap: [
    { id: 1, address: '0x01', role: 'SOLAR' as const },
    { id: 2, address: '0x02', role: 'FUEL_CELL' as const },
    { id: 3, address: '0x03', role: 'LOAD' as const },
  ],
  temperatureProtocol: '1-Wire (DS18B20, 12-bit)',
  connectivity: 'Wi-Fi 802.11 b/g/n + TLS 1.2',
  aiRuntime: 'TensorFlow Lite Micro / EspDl on ESP32-S3 (512 KB SRAM)',
} as const;

export const AI_MODELS = [
  {
    key: 'soc' as const,
    index: '01',
    name: 'SOC Prediction',
    short: 'State of charge forecast',
    description:
      'Recurrent inference over voltage, current and load history estimates the state of charge of the 48 V pack and projects it forward so range planning stays ahead of the driver.',
    accent: 'volt' as const,
  },
  {
    key: 'range' as const,
    index: '02',
    name: 'Range Prediction',
    short: 'Remaining range forecast',
    description:
      'Consumes the SOC horizon, mean rolling power draw and recent efficiency to publish a kilometres-remaining estimate with a confidence band that widens under load.',
    accent: 'ion' as const,
  },
  {
    key: 'anomaly' as const,
    index: '03',
    name: 'Anomaly Detection',
    short: 'Signature-level fault detection',
    description:
      'A lightweight auto-encoder scores every telemetry frame against learned normal behaviour, isolating sensor faults, bus brown-outs and abnormal thermal drift at the edge.',
    accent: 'hydro' as const,
  },
] as const;

/** Engineering thresholds used across telemetry, alerting and thermal pages. */
export const THRESHOLDS = {
  socLow: 25,
  socCritical: 12,
  batteryVoltageNominal: 52.8,
  batteryVoltageLow: 46,
  batteryVoltageHigh: 58.4,
  vehicleCurrentHigh: 60,
  vehiclePowerHigh: 3000,
  fuelCellPowerNominal: 1500,
  solarPowerNominal: 2000,
  thermal: {
    warm: 40,
    high: 55,
    critical: 68,
  },
  anomaly: {
    warning: 0.35,
    critical: 0.6,
  },
  consumption: {
    efficient: 180,
    warn: 320,
  },
  trip: {
    gapSeconds: 300,
    minDistanceKm: 0.2,
    minSpeedKph: 4,
  },
} as const;

export const ALERT_RULES: {
  category: AlertCategory;
  severity: AlertSeverity;
  label: string;
  threshold: number;
  unit: string;
  source: string;
  message: (v: number) => string;
}[] = [
  {
    category: 'high-temperature',
    severity: 'critical',
    label: 'High temperature',
    threshold: THRESHOLDS.thermal.high,
    unit: '°C',
    source: 'DS18B20',
    message: (v) => `Thermal probe reading ${v.toFixed(1)} °C exceeded the high-temperature limit.`,
  },
  {
    category: 'low-soc',
    severity: 'warning',
    label: 'Low state of charge',
    threshold: THRESHOLDS.socLow,
    unit: '%',
    source: 'PZEM #3 / AI-SOC',
    message: (v) => `State of charge fell to ${v.toFixed(1)} %, below the reserve threshold.`,
  },
  {
    category: 'high-current',
    severity: 'warning',
    label: 'High current draw',
    threshold: THRESHOLDS.vehicleCurrentHigh,
    unit: 'A',
    source: 'PZEM #3',
    message: (v) => `Traction current reached ${v.toFixed(1)} A, above continuous design limit.`,
  },
  {
    category: 'high-power',
    severity: 'warning',
    label: 'High power load',
    threshold: THRESHOLDS.vehiclePowerHigh,
    unit: 'W',
    source: 'PZEM #3',
    message: (v) => `Vehicle load reached ${(v / 1000).toFixed(2)} kW, above continuous design limit.`,
  },
  {
    category: 'abnormal-voltage',
    severity: 'critical',
    label: 'Abnormal bus voltage',
    threshold: THRESHOLDS.batteryVoltageLow,
    unit: 'V',
    source: 'PZEM #3',
    message: (v) => `48 V bus collapsed to ${v.toFixed(1)} V — possible brown-out or cell fault.`,
  },
  {
    category: 'comm-failure',
    severity: 'info',
    label: 'Communication failure',
    threshold: 30,
    unit: 's',
    source: 'ESP32-S3 / Wi-Fi',
    message: (v) => `No telemetry received for ${Math.round(v)} s.`,
  },
  {
    category: 'ai-anomaly',
    severity: 'critical',
    label: 'AI anomaly detected',
    threshold: THRESHOLDS.anomaly.warning,
    unit: '',
    source: 'AI-MODEL-03',
    message: (v) => `Edge anomaly model reported a score of ${v.toFixed(3)} (threshold 0.350).`,
  },
];

export const ALERT_CATEGORY_META: Record<AlertCategory, { label: string; tone: string }> = {
  'high-temperature': { label: 'High temperature', tone: 'danger' },
  'low-soc': { label: 'Low SOC', tone: 'warn' },
  'high-current': { label: 'High current', tone: 'warn' },
  'high-power': { label: 'High power', tone: 'warn' },
  'abnormal-voltage': { label: 'Abnormal voltage', tone: 'danger' },
  'comm-failure': { label: 'Communication failure', tone: 'ion' },
  'ai-anomaly': { label: 'AI anomaly', tone: 'danger' },
};

export const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { href: '/dashboard', label: 'Overview', icon: 'LayoutDashboard' },
      { href: '/dashboard/live', label: 'Live Vehicle', icon: 'Radio' },
      { href: '/dashboard/energy', label: 'Energy', icon: 'Zap' },
      { href: '/dashboard/battery', label: 'Battery', icon: 'BatteryCharging' },
      { href: '/dashboard/solar', label: 'Solar', icon: 'Sun' },
      { href: '/dashboard/fuel-cell', label: 'Fuel Cell', icon: 'Flame' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/dashboard/ai', label: 'AI Intelligence', icon: 'BrainCircuit' },
      { href: '/dashboard/thermal', label: 'Thermal', icon: 'Thermometer' },
      { href: '/dashboard/analytics', label: 'Analytics', icon: 'LineChart' },
      { href: '/dashboard/trips', label: 'Trips', icon: 'Route' },
      { href: '/dashboard/alerts', label: 'Alerts', icon: 'BellRing' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/dashboard/data', label: 'Data History', icon: 'Table2' },
      { href: '/dashboard/reports', label: 'Reports', icon: 'FileBarChart' },
      { href: '/dashboard/device', label: 'Device', icon: 'Cpu' },
      { href: '/architecture', label: 'Architecture', icon: 'Network' },
      { href: '/dashboard/settings', label: 'Settings', icon: 'Settings2' },
    ],
  },
] as const;

export const FOOTER_NAV = [
  {
    label: 'Platform',
    links: [
      { label: 'Overview', href: '/dashboard' },
      { label: 'Live Vehicle', href: '/dashboard/live' },
      { label: 'Energy Flow', href: '/dashboard/energy' },
      { label: 'AI Intelligence', href: '/dashboard/ai' },
    ],
  },
  {
    label: 'Reference',
    links: [
      { label: 'System Architecture', href: '/architecture' },
      { label: 'Performance', href: '/performance' },
      { label: 'Technology', href: '/technology' },
      { label: 'About the project', href: '/about' },
    ],
  },
  {
    label: 'Data',
    links: [
      { label: 'Telemetry history', href: '/dashboard/data' },
      { label: 'Reports', href: '/dashboard/reports' },
      { label: 'Alerts', href: '/dashboard/alerts' },
      { label: 'Trips', href: '/dashboard/trips' },
    ],
  },
] as const;

export const REPORT_TYPES = [
  {
    key: 'daily',
    title: 'Daily Operations Report',
    description: 'Rolling 24-hour energy balance, driving duty, thermal envelope and AI inference summary.',
    sections: ['Energy balance', 'Peak and mean power', 'SOC trajectory', 'Thermal envelope', 'Alert digest'],
    cadence: 'Auto-generated 00:05 local',
  },
  {
    key: 'weekly',
    title: 'Weekly Fleet Performance',
    description: 'Seven-day source contribution, efficiency trend, regenerative recovery and fault frequency.',
    sections: ['Source contribution', 'Efficiency trend', 'Regeneration', 'Fault frequency', 'Recommendations'],
    cadence: 'Auto-generated Monday 00:05',
  },
  {
    key: 'monthly',
    title: 'Monthly Sustainability Report',
    description: 'Carbon-avoided estimate, solar and hydrogen yield, cost-of-energy trend and asset health.',
    sections: ['Carbon avoided', 'Source yield', 'Energy cost trend', 'Asset health', 'Trend outlook'],
    cadence: 'On demand / month close',
  },
  {
    key: 'trip',
    title: 'Trip Energy Dossier',
    description: 'Per-journey dossier: distance, efficiency, SOC delta, temperature profile and AI events.',
    sections: ['Route summary', 'Energy usage', 'SOC change', 'Temperature', 'AI events'],
    cadence: 'On demand per trip',
  },
  {
    key: 'energy',
    title: 'Energy Flow Audit',
    description: 'Channel-level accounting of every watt-hour moved through solar, fuel cell, pack and traction bus.',
    sections: ['Generation ledger', 'Consumption ledger', 'Loss estimate', 'Source split', 'Net position'],
    cadence: 'On demand per window',
  },
  {
    key: 'ai',
    title: 'Embedded AI Performance',
    description: 'Edge-model telemetry: latency budget, confidence distribution, anomaly interventions.',
    sections: ['Model status', 'Inference latency', 'Confidence drift', 'Anomaly log', 'Edge budget'],
    cadence: 'On demand per window',
  },
  {
    key: 'thermal',
    title: 'Thermal Compliance Report',
    description: 'Probe-by-probe thermal audit against derating limits with excursion history.',
    sections: ['Probe matrix', 'Excursions', 'Derating margin', 'Ambient context', 'Actions'],
    cadence: 'Daily + on excursion',
  },
] as const;

export const SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', description: 'Operator identity and role', icon: 'User' },
  { key: 'device', label: 'Device', description: 'Active device, sampling and thresholds', icon: 'Cpu' },
  { key: 'units', label: 'Units', description: 'Metric / imperial presentation', icon: 'Ruler' },
  { key: 'notifications', label: 'Notifications', description: 'Channels and quiet hours', icon: 'BellRing' },
  { key: 'retention', label: 'Data retention', description: 'Downsampling and purge policy', icon: 'Database' },
  { key: 'database', label: 'Database', description: 'Connection and collection health', icon: 'HardDrive' },
  { key: 'appearance', label: 'Appearance', description: 'Density, accent and motion', icon: 'Palette' },
] as const;

export const SEVERITY_TONE: Record<AlertSeverity, { text: string; ring: string; dot: string }> = {
  info: { text: 'text-ion-300', ring: 'ring-ion-500/25', dot: 'bg-ion-400' },
  warning: { text: 'text-warn-400', ring: 'ring-warn-500/25', dot: 'bg-warn-400' },
  critical: { text: 'text-danger-400', ring: 'ring-danger-500/25', dot: 'bg-danger-400' },
};

export const THERMAL_TONE: Record<ThermalStatus, { text: string; label: string; ring: string; bar: string }> = {
  normal: { text: 'text-hydro-400', label: 'NORMAL', ring: 'ring-hydro-500/25', bar: 'from-hydro-500 to-hydro-400' },
  warm: { text: 'text-ion-300', label: 'WARM', ring: 'ring-ion-500/25', bar: 'from-ion-500 to-ion-300' },
  high: { text: 'text-warn-400', label: 'HIGH', ring: 'ring-warn-500/25', bar: 'from-warn-500 to-warn-400' },
  critical: { text: 'text-danger-400', label: 'CRITICAL', ring: 'ring-danger-500/25', bar: 'from-danger-600 to-danger-400' },
};

export const AI_TONE: Record<AiModelState, { text: string; label: string; ring: string; dot: string }> = {
  normal: { text: 'text-hydro-400', label: 'NORMAL', ring: 'ring-hydro-500/25', dot: 'bg-hydro-400' },
  warning: { text: 'text-warn-400', label: 'WARNING', ring: 'ring-warn-500/25', dot: 'bg-warn-400' },
  anomaly: { text: 'text-danger-400', label: 'ANOMALY', ring: 'ring-danger-500/25', dot: 'bg-danger-400' },
};

export const CHART_COLORS = {
  solar: '#FBBF24',
  fuelCell: '#22D3EE',
  vehicle: '#60A5FA',
  battery: '#A78BFA',
  soc: '#3B82F6',
  temp1: '#22D3EE',
  temp2: '#60A5FA',
  temp3: '#A78BFA',
  temp4: '#34D399',
  anomaly: '#F87171',
  grid: 'rgba(255,255,255,0.06)',
  axis: 'rgba(148,163,184,0.75)',
} as const;

export const TIMESTAMP_FIELDS = ['timestamp'] as const;
