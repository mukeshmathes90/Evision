import { NextResponse } from 'next/server';
import { databaseHealth } from '@/lib/mongodb';
import { MONGODB_DATABASE } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Unauthenticated liveness probe used by uptime monitors.
 *
 * `ok` reflects service health, not merely reachability: a healthy deployment
 * answers 200 with `ok: true`, a deployment that cannot reach Atlas answers 503
 * with `ok: false` and a short reason. Never exposes the connection string —
 * only the logical database name and the resolved state.
 */
export async function GET() {
  const health = await databaseHealth();
  const body = {
    database: MONGODB_DATABASE,
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
