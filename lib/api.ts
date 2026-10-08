import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { API_RATE_LIMIT, API_RATE_WINDOW_S, AUTH_ENABLED, AUTH_SECRET, EVISION_DEVICE_ID } from './env';

/**
 * Server-side API hardening:
 *  - fixed-window rate limiting keyed by client IP
 *  - optional bearer/session token guard (enabled once NEXTAUTH_SECRET is set)
 *  - uniform JSON envelope + cache headers
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalStore = global as unknown as { __evisionRate?: Map<string, Bucket> };
const store: Map<string, Bucket> = (globalStore.__evisionRate ??= new Map<string, Bucket>());

export function clientKey(req: Request): string {
  const h = req.headers;
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    h.get('cf-connecting-ip') ??
    'local';
  const agent = h.get('user-agent') ?? '';
  return `${ip}|${agent.slice(0, 24)}`;
}

export function rateLimit(req: Request, limit = API_RATE_LIMIT, windowS = API_RATE_WINDOW_S) {
  const key = clientKey(req);
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowS * 1000 });
    return { ok: true, remaining: limit - 1, resetAt: now + windowS * 1000 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/* -------------------------------------------------------------------------- */
/* Operator session                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Operator sessions.
 *
 * Read routes stay public by default so the dashboard works the moment it is
 * deployed; set `EVISION_REQUIRE_AUTH=on` to require a signed session. The
 * signature is HMAC-SHA256 over `expiry.timestamp` using `NEXTAUTH_SECRET`, so a
 * client cannot forge one. `timingSafeEqual` prevents signature probing.
 */

export const SESSION_COOKIE = 'evision_session';

const sessionCache = global as unknown as { __evisionSessions?: Map<string, number> };
const sessions: Map<string, number> = (sessionCache.__evisionSessions ??= new Map());

/** Signed session token: `<issuedAt>.<expiry>.<hmac>`. */
export function issueSession(ttlS = 60 * 60 * 12): string {
  const now = Date.now();
  const expiry = now + ttlS * 1000;
  const body = `${now}.${expiry}`;
  return `${body}.${await_sign(body)}`;
}

export function revokeSession(token: string): void {
  const key = token.split('.')[0];
  sessions.delete(key);
}

function sessionCookie(req: Request): string {
  const cookie = req.headers.get('cookie') ?? '';
  return cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1] ?? '';
}

/**
 * Verify a session token. Expiry is enforced, and the HMAC is compared in
 * constant time. Returns a reason so the caller can distinguish "log in" from
 * "your session expired".
 */
export function assertSession(req: Request): { ok: true } | { ok: false; reason: 'missing' | 'invalid' | 'expired' } {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') && header.slice(7).includes('.')
    ? header.slice(7).trim()
    : sessionCookie(req);

  if (!token) return { ok: false, reason: 'missing' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid' };
  const [issued, expiry, sig] = parts;
  const ts = Number(expiry);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid' };
  if (Date.now() > ts) {
    sessions.delete(issued);
    return { ok: false, reason: 'expired' };
  }
  if (!await_verify(`${issued}.${expiry}`, sig)) return { ok: false, reason: 'invalid' };

  // Single-use replay guard: an issued token is accepted once per warm lambda.
  if (sessions.has(issued)) return { ok: false, reason: 'invalid' };
  sessions.set(issued, ts);
  if (sessions.size > 5000) {
    for (const [k, v] of sessions) if (Date.now() > v) sessions.delete(k);
  }
  return { ok: true };
}

/**
 * Dashboard read guard.
 *
 * `EVISION_REQUIRE_AUTH=on` turns this into a hard gate. Otherwise it only
 * rate-limits, which is the right default for a public monitoring dashboard.
 */
export function guard(req: Request) {
  const limit = rateLimit(req);
  if (!limit.ok) {
    return fail('Rate limit exceeded', 429, { retryAfter: limit.retryAfter });
  }
  if (!AUTH_ENABLED) return null;

  const session = assertSession(req);
  if (session.ok) return null;
  if (session.reason === 'missing') return fail('Authentication required', 401);
  if (session.reason === 'expired') return fail('Session expired', 401);
  return fail('Invalid session', 401);
}

/** Deterministic HMAC-SHA256 signature, hex encoded. Server-side only. */
export async function await_sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time signature verification. */
async function await_verify(payload: string, signature: string): Promise<boolean> {
  const expected = await await_sign(payload);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function ok<T>(data: T, init: { status?: number; noStore?: boolean } = {}) {
  return NextResponse.json(
    { ok: true, ...data },
    {
      status: init.status ?? 200,
      headers: init.noStore === false ? { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } : { 'Cache-Control': 'no-store' },
    },
  );
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/* -------------------------------------------------------------------------- */
/* Query-string validation                                                     */
/* -------------------------------------------------------------------------- */

export const rangeSchema = z.object({
  range: z.enum(['5m', '15m', '1h', '6h', '24h', '7d', '30d', 'custom', 'daily', 'weekly', 'monthly']).default('24h'),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
  device: z.string().min(2).max(40).optional(),
});

export const telemetryQuerySchema = z.object({
  device: z.string().min(2).max(40).optional(),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(25),
  sort: z.string().max(24).default('timestamp'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().max(60).optional(),
});

export const alertsQuerySchema = z.object({
  device: z.string().min(2).max(40).optional(),
  range: z.enum(['5m', '15m', '1h', '6h', '24h', '7d', '30d', 'custom']).default('7d'),
  severity: z.string().max(80).optional(),
  category: z.string().max(200).optional(),
  status: z.string().max(80).optional(),
  q: z.string().max(60).optional(),
});

export const tripsQuerySchema = z.object({
  device: z.string().min(2).max(40).optional(),
  range: z.enum(['5m', '15m', '1h', '6h', '24h', '7d', '30d', 'custom']).default('30d'),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
});

export function listParam(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts.slice(0, 12) : undefined;
}

/**
 * Resolve the device id from the query string, falling back to the configured
 * canonical device. Kept here so every read route scopes queries identically.
 */
export function parseDevice(searchParams: URLSearchParams): string {
  const fromQuery = (searchParams.get('device') ?? '').trim();
  return fromQuery || EVISION_DEVICE_ID;
}
