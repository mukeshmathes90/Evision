import { NextResponse } from 'next/server';
import { firebaseHealth } from '@/lib/firebase';
import { FIREBASE_PROJECT_ID } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Unauthenticated liveness probe used by uptime monitors.
 *
 * `ok` reflects service health, not merely reachability: a healthy deployment
 * answers 200 with `ok: true`, a deployment that cannot reach Firebase
 * answers 503 with `ok: false` and a short reason. Never exposes any secret —
 * only the resolved Firebase project and state.
 */
export async function GET() {
  const health = await firebaseHealth();
  const body = {
    database: FIREBASE_PROJECT_ID,
    configured: health.configured,
    connected: health.connected,
    state: health.state,
    latencyMs: health.latencyMs,
    host: health.host,
    poolSize: health.poolSize,
    error: health.connected ? null : health.error,
    checkedAt: new Date().toISOString(),
  };

  if (health.connected) {
    return NextResponse.json({ ok: true, status: 'ok', ...body }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(
    { ok: false, status: 'degraded', ...body },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
