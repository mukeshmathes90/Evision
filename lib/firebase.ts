import 'server-only';
import { FIREBASE_PROJECT_ID, FIREBASE_RTDB_URL, firebaseGetJson } from './firebase-core';

/**
 * Composite Firebase health probe.
 *
 * Never throws — a failed probe is reported, not raised. Keeps the same field
 * shape the previous MongoDB probe exposed so the health route and Settings
 * page render without UI changes.
 */
export async function firebaseHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  state: string;
  host: string;
  database: string;
  latencyMs: number | null;
  error: string | null;
  poolSize: number;
}> {
  const base = {
    configured: true,
    connected: false,
    state: 'disconnected',
    host: FIREBASE_RTDB_URL.replace(/^https?:\/\//, ''),
    database: FIREBASE_PROJECT_ID,
    latencyMs: null as number | null,
    error: null as string | null,
    poolSize: 0,
  };

  try {
    const t0 = Date.now();
    await firebaseGetJson('', 4000);
    return { ...base, connected: true, state: 'connected', latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ...base, error: (err as Error).message };
  }
}