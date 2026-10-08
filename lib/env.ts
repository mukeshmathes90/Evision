/**
 * Centralised, validated environment access.
 *
 * Every value is read through this module so that (a) defaults live in one
 * place and (b) it is impossible to accidentally reference a secret in a
 * client component — the `NEXT_PUBLIC_` prefix is not used anywhere.
 */

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v == null ? fallback : v.trim();
}

function int(name: string, fallback: number): number {
  const v = Number.parseInt(str(name), 10);
  return Number.isFinite(v) ? v : fallback;
}

/** MongoDB Atlas connection string — SERVER SIDE ONLY. */
export const MONGODB_URI = str('MONGODB_URI');

export const MONGODB_DATABASE = str('MONGODB_DATABASE', 'evision');

export const MONGODB_COLLECTIONS = {
  devices: str('MONGODB_COLLECTION_DEVICES', 'devices'),
  telemetry: str('MONGODB_COLLECTION_TELEMETRY', 'telemetry'),
  aiPredictions: str('MONGODB_COLLECTION_AI_PREDICTIONS', 'ai_predictions'),
  alerts: str('MONGODB_COLLECTION_ALERTS', 'alerts'),
  trips: str('MONGODB_COLLECTION_TRIPS', 'trips'),
  energySessions: str('MONGODB_COLLECTION_ENERGY_SESSIONS', 'energy_sessions'),
  systemEvents: str('MONGODB_COLLECTION_SYSTEM_EVENTS', 'system_events'),
} as const;

export const EVISION_DEVICE_ID = str('EVISION_DEVICE_ID', 'EV-001');

/**
 * Used only by the development seed scripts — never read by the website.
 */
export const EVISION_DEMO_DEVICE_ID = str('EVISION_DEMO_DEVICE_ID', 'EV-DEMO-001');

export const ONLINE_WINDOW_S = int('EVISION_ONLINE_WINDOW_S', 10);
export const DELAYED_WINDOW_S = int('EVISION_DELAYED_WINDOW_S', 30);

export const API_RATE_LIMIT = int('EVISION_API_RATE_LIMIT', 240);
export const API_RATE_WINDOW_S = int('EVISION_API_RATE_WINDOW_S', 60);

/** Operator session secret. Reads stay public unless `EVISION_REQUIRE_AUTH=on`. */
export const AUTH_SECRET = str('NEXTAUTH_SECRET', 'evision-dev-secret-change-me');
export const AUTH_ENABLED = str('EVISION_REQUIRE_AUTH', 'off').toLowerCase() === 'on';
export const OPERATOR_PASSWORD = str('EVISION_OPERATOR_PASSWORD');
