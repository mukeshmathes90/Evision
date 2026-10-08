import { guard, ok, fail } from '@/lib/api';
import { deviceFromParams } from '@/lib/api-range';
import { getLatest } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const sp = new URL(req.url).searchParams;
    const envelope = await getLatest(deviceFromParams(sp));
    return ok({ envelope });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}
