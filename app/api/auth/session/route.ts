import { NextResponse } from 'next/server';
import { fail, issueSession, revokeSession, SESSION_COOKIE } from '@/lib/api';
import { AUTH_ENABLED, OPERATOR_PASSWORD } from '@/lib/env';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Operator login for the dashboard.
 *
 * Only meaningful when `EVISION_REQUIRE_AUTH=on`. Read APIs stay public by
 * default, so this route is inert until you opt in. The password is compared in
 * constant time and the issued cookie is `HttpOnly` + `SameSite=Strict`, so the
 * session token is unreachable from client JavaScript.
 *
 * POST   { "password": "…" }  -> 201 + Set-Cookie
 * DELETE                     -> 200 + cleared cookie
 * GET                        -> whether auth is required
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const bodySchema = z.object({ password: z.string().min(1).max(200) }).strict();

function equal(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function GET() {
  return NextResponse.json(
    { ok: true, authRequired: AUTH_ENABLED, passwordConfigured: Boolean(OPERATOR_PASSWORD) },
    { status: 200, headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  if (!AUTH_ENABLED) {
    return fail('Authentication is disabled on this deployment', 404);
  }
  if (!OPERATOR_PASSWORD) {
    // Fail closed: without a configured password nobody can get in, and the
    // deployment is visibly misconfigured rather than silently open.
    return fail('Operator password is not configured', 503);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail('Body must be valid JSON', 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail('Invalid request body', 400);

  if (!equal(parsed.data.password, OPERATOR_PASSWORD)) {
    return fail('Invalid credentials', 401);
  }

  const token = issueSession();
  const res = NextResponse.json({ ok: true, issuedAt: new Date().toISOString() }, { status: 201, headers: NO_STORE });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE(req: Request) {
  const cookie = req.headers.get('cookie') ?? '';
  const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1] ?? '';
  if (token) revokeSession(token);
  const res = NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}